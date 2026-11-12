import asyncio
import time
import statistics
import uuid
import httpx
from web3 import Web3

# ==============================================================================
# CONFIGURATION
# ==============================================================================
FASTAPI_VERIFIER_URL = "http://127.0.0.1:8012"
FASTAPI_ISSUER_URL = "http://127.0.0.1:8002"
IPFS_API_URL = "http://127.0.0.1:5001/api/v0/add"
ANVIL_RPC_URL = "http://127.0.0.1:8545"

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))
HUMAN_OWNER_ADDRESS = w3.eth.accounts[0]
HUMAN_OWNER_DID = "8jMaEBx4cqXoXtJUW5PVnc"

def calculate_p95(data_list):
    if not data_list: return 0
    return sorted(data_list)[int(len(data_list) * 0.95)]

# ==============================================================================
# EXPERIMENT 1: IPFS DAEMON LATENCY & O(1) SCALING
# ==============================================================================
async def run_ipfs_scaling_test(client: httpx.AsyncClient):
    print("\n📦 [1/3] EXPERIMENT A: IPFS PAYLOAD SCALING LATENCY...")
    payload_sizes_kb = [1, 10, 50, 100, 500, 1000]
    
    for size_kb in payload_sizes_kb:
        payload = b"X" * (size_kb * 1024)
        t0 = time.perf_counter()
        
        # Real HTTP POST to local IPFS Daemon
        res = await client.post(IPFS_API_URL, files={"file": payload}, timeout=10.0)
        ipfs_ms = (time.perf_counter() - t0) * 1000
        
        cid = res.json().get("Hash", "Error")
        print(f"  🔹 Payload: {size_kb:4d} KB | IPFS Upload Latency: {ipfs_ms:6.2f} ms | CID: {cid[:12]}...")

# ==============================================================================
# EXPERIMENT 2: ISSUER PROTOCOLS (1 & 5) BASELINE LATENCY (N=10)
# ==============================================================================
async def run_issuer_baselines(client: httpx.AsyncClient):
    print("\n🏛️ [2/3] EXPERIMENT B: ISSUER PROTOCOLS (N=10 ITERATIONS)...")
    p1_lats, p5_lats = [], []
    
    for i in range(10):
        # Protocol 1: Create SSI Identity
        t0 = time.perf_counter()
        res_p1 = await client.post(
            f"{FASTAPI_ISSUER_URL}/protocol1/create-ssi-identity",
            json={"gov_id": f"GOV-{uuid.uuid4().hex[:6]}", "name": f"User_{i}"},
            timeout=30.0
        )
        p1_lats.append((time.perf_counter() - t0) * 1000)
        
        # Protocol 5: Revoke Credential (Expect 404/Error if cred doesn't exist, but measures lookup overhead)
        t0 = time.perf_counter()
        await client.post(
            f"{FASTAPI_ISSUER_URL}/protocol5/revoke",
            json={"holder_did": f"LIC-TEST-{i}", "claim_type": "DeFiTradingLicense"},
            timeout=30.0
        )
        p5_lats.append((time.perf_counter() - t0) * 1000)

    print(f"  🔹 P1 (Identity Creation) : Mean {statistics.mean(p1_lats):.2f} ms ± {statistics.stdev(p1_lats):.2f} | p95: {calculate_p95(p1_lats):.2f} ms")
    print(f"  🔹 P5 (Revocation Gate)   : Mean {statistics.mean(p5_lats):.2f} ms ± {statistics.stdev(p5_lats):.2f} | p95: {calculate_p95(p5_lats):.2f} ms")

# ==============================================================================
# EXPERIMENT 3: CONCURRENT SWARM SCALING (TPS & LATENCY)
# ==============================================================================
class SwarmAgent:
    def __init__(self, idx):
        self.idx = idx
        self.did = None
        self.eth_address = None

    async def onboard(self, client: httpx.AsyncClient):
        # Sequentially onboard to avoid Anvil Account[0] nonce collisions
        res = await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol2/register-abcd",
            json={
                "owner_did": HUMAN_OWNER_DID,
                "model_architecture": f"Agent-{self.idx}",
                "version_tag": "v1.0",
                "training_hash": w3.keccak(text=f"hash_{self.idx}_{time.time()}").hex()
            },
            timeout=30.0
        )
        data = res.json()
        self.did = data["abcd_layers"]["C"]["did"]
        self.eth_address = data["abcd_layers"]["C"]["wallet_address"]
        
        # Fund EOA directly for concurrency stability
        w3.eth.send_transaction({
            'from': HUMAN_OWNER_ADDRESS,
            'to': w3.to_checksum_address(self.eth_address),
            'value': w3.to_wei(0.5, 'ether')
        })
        
        # Set generous policy
        await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol6/delegate",
            json={"owner_address": HUMAN_OWNER_ADDRESS, "agent_did": self.did, "spend_limit_eth": 10.0, "duration_seconds": 3600},
            timeout=20.0
        )

    async def execute_trade(self, client: httpx.AsyncClient):
        t0 = time.perf_counter()
        res = await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol6/execute-trade",
            json={"agent_did": self.did, "amount_eth": 0.01},
            timeout=20.0
        )
        return (time.perf_counter() - t0) * 1000, res.status_code == 200

async def run_swarm_scaling(client: httpx.AsyncClient):
    print("\n⚡ [3/3] EXPERIMENT C: CONCURRENT SWARM SCALING (TPS & LATENCY DEGRADATION)...")
    scaling_levels = [5, 10, 25, 50]
    
    # Pre-onboard maximum needed agents (50) to isolate execution metrics
    print(f"  [Setup] Pre-onboarding 50 autonomous agents. Please wait (~15 seconds)...")
    agents = [SwarmAgent(i) for i in range(50)]
    for agent in agents:
        await agent.onboard(client)
    
    print("  [Setup] Agents onboarded. Commencing concurrent load tests...\n")
    
    for n in scaling_levels:
        active_cohort = agents[:n]
        
        t_start = time.perf_counter()
        # Fire concurrent execution!
        results = await asyncio.gather(*(agent.execute_trade(client) for agent in active_cohort))
        t_total = time.perf_counter() - t_start
        
        latencies = [r[0] for r in results if r[1]] # Only measure successful trades
        success_count = sum(1 for r in results if r[1])
        tps = success_count / t_total
        
        if len(latencies) > 1:
            mean_lat = statistics.mean(latencies)
            std_lat = statistics.stdev(latencies)
            p95_lat = calculate_p95(latencies)
        else:
            mean_lat = std_lat = p95_lat = 0.0
            
        print(f"  🚀 N={n:2d} Agents | Throughput: {tps:5.1f} TPS | Latency: Mean {mean_lat:6.1f} ms ± {std_lat:5.1f} (p95: {p95_lat:6.1f} ms) | Success: {success_count}/{n}")

async def main():
    async with httpx.AsyncClient() as client:
        # Verify APIs are up
        try:
            assert (await client.get(f"{FASTAPI_VERIFIER_URL}/")).status_code == 200
            assert (await client.get(f"{FASTAPI_ISSUER_URL}/")).status_code == 200
        except Exception as e:
            print("❌ ERROR: Ensure both Verifier (8000) and Issuer (8001) FastAPI servers are running!")
            return
            
        await run_ipfs_scaling_test(client)
        await run_issuer_baselines(client)
        await run_swarm_scaling(client)
        
    print("\n🎉 ALL IEEE ICBC DATA COLLECTION COMPLETE!")

if __name__ == "__main__":
    asyncio.run(main())