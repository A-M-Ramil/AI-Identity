import asyncio
import time
import statistics
import json
import httpx
from web3 import Web3

# Point to your ACTUAL running services
FASTAPI_VERIFIER_URL = "http://127.0.0.1:8012"  # Change port if your uvicorn runs on 8001/etc.
ANVIL_RPC_URL = "http://127.0.0.1:8545"
ACAPY_ADMIN_URL = "http://127.0.0.1:8030"

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))
HUMAN_OWNER_ADDRESS = w3.eth.accounts[0]
HUMAN_OWNER_DID = "8jMaEBx4cqXoXtJUW5PVnc"

class AutonomousAgentWorker:
    def __init__(self, agent_id: int, behavior_type: str):
        self.agent_id = agent_id
        self.behavior_type = behavior_type
        self.did = None
        self.eth_address = None
        self.model_arch = f"Llama-3-8B-DeFi-Agent-{agent_id}"
        self.version = "v1.0.4"
        self.training_hash = Web3.keccak(text=f"weights_seed_{agent_id}_{time.time()}").hex()

    async def onboard_via_protocol2(self, client: httpx.AsyncClient):
        if self.behavior_type == "unregistered_spoof":
            self.did = f"did:sov:fake_unregistered_{self.agent_id}"
            return 0.0, False

        t0 = time.perf_counter()
        res = await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol2/register-abcd",
            json={
                "owner_did": HUMAN_OWNER_DID,
                "model_architecture": self.model_arch,
                "version_tag": self.version,
                "training_hash": self.training_hash
            },
            timeout=30.0
        )
        latency_ms = (time.perf_counter() - t0) * 1000
        if res.status_code == 200:
            data = res.json()
            self.did = data["abcd_layers"]["C"]["did"]
            self.eth_address = data["abcd_layers"]["C"]["wallet_address"]
            return latency_ms, True
        else:
            raise Exception(f"Protocol 2 failed: {res.text}")

    async def setup_funding_and_delegation(self, client: httpx.AsyncClient):
        if self.behavior_type == "unregistered_spoof":
            return

        # 1. Fund the agent's real EOA directly via Anvil so it has 1.0 ETH for gas + trades
        tx_hash = w3.eth.send_transaction({
            'from': HUMAN_OWNER_ADDRESS,
            'to': w3.to_checksum_address(self.eth_address),
            'value': w3.to_wei(1.0, 'ether')
        })
        w3.eth.wait_for_transaction_receipt(tx_hash)

        # 2. Set Protocol 6 Delegation Policy via FastAPI
        duration = 0 if self.behavior_type == "expired_policy" else 3600
        await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol6/delegate",
            json={
                "owner_address": HUMAN_OWNER_ADDRESS,
                "agent_did": self.did,
                "spend_limit_eth": 0.5,
                "duration_seconds": duration
            },
            timeout=20.0
        )

    async def act_autonomously(self, client: httpx.AsyncClient):
        t0 = time.perf_counter()

        # Step A: Verify Ownership Link on Blockchain (Protocol 2)
        verify_res = await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol2/verify-link",
            json={"owner_did": HUMAN_OWNER_DID, "agent_did": self.did},
            timeout=20.0
        )
        verify_data = verify_res.json()

        # Step B: Attempt Trade Execution via Protocol 6
        trade_amount = 1.5 if self.behavior_type == "over_limit" else 0.1

        trade_res = await client.post(
            f"{FASTAPI_VERIFIER_URL}/protocol6/execute-trade",
            json={"agent_did": self.did, "amount_eth": trade_amount},
            timeout=20.0
        )
        total_latency_ms = (time.perf_counter() - t0) * 1000

        trade_data = trade_res.json() if trade_res.status_code == 200 else {"status": "blocked_404", "reason": "Unregistered DID Rejected"}
        return {
            "agent_id": self.agent_id,
            "did": self.did,
            "behavior": self.behavior_type,
            "is_linked": verify_data.get("is_linked", False),
            "trade_status": trade_data.get("status"),
            "reason": trade_data.get("reason", f"TX: {trade_data.get('tx_hash', '')[:12]}..."),
            "latency_ms": total_latency_ms
        }

async def main():
    print("🔎 Checking live services (Anvil, ACA-Py, FastAPI)...")
    async with httpx.AsyncClient() as client:
        assert (await client.get(f"{FASTAPI_VERIFIER_URL}/")).status_code == 200
        assert (await client.get(f"{ACAPY_ADMIN_URL}/status/ready")).status_code == 200
    print("✅ All live services connected!\n")

    swarm = (
        [AutonomousAgentWorker(i, "honest") for i in range(1, 4)] +
        [AutonomousAgentWorker(i, "over_limit") for i in range(4, 7)] +
        [AutonomousAgentWorker(i, "expired_policy") for i in range(7, 10)] +
        [AutonomousAgentWorker(i, "unregistered_spoof") for i in range(10, 13)]
    )

    async with httpx.AsyncClient() as client:
        print("🤖 PHASE 1: Onboarding Real Agents via Protocol 2 (ACA-Py + Anvil + agent_keys.json)...")
        p2_latencies = []
        for agent in swarm:
            lat, ok = await agent.onboard_via_protocol2(client)
            if ok:
                p2_latencies.append(lat)
                print(f"  ✅ Agent #{agent.agent_id:02d} ({agent.behavior_type:18s}) | Real ACA-Py DID: {agent.did} | EOA: {agent.eth_address[:10]}... | {lat:.1f} ms")
            else:
                print(f"  🕵️ Agent #{agent.agent_id:02d} ({agent.behavior_type:18s}) | Skipped P2 (Simulating Unregistered Spoofer) | Fake DID: {agent.did}")

        print(f"\n📊 Avg End-to-End Protocol 2 Onboarding Latency (ACA-Py + Anvil + Enclave IO): {statistics.mean(p2_latencies):.2f} ms\n")

        print("💸 PHASE 2: Funding Agent EOAs & Anchoring Protocol 6 Delegation Policies...")
        for agent in swarm:
            await agent.setup_funding_and_delegation(client)

        # Advance Anvil block timestamp by 5 seconds so 0s duration policies are strictly expired
        w3.provider.make_request("evm_increaseTime", [5])
        w3.provider.make_request("evm_mine", [])

        print("\n⚡ PHASE 3: Launching Concurrent Autonomous Swarm Execution (asyncio.gather)...")
        t_start = time.perf_counter()
        results = await asyncio.gather(*(agent.act_autonomously(client) for agent in swarm))
        t_total = time.perf_counter() - t_start

        print("\n================ SWARM EXECUTION RESULTS ================")
        for r in results:
            print(f"  Agent #{r['agent_id']:02d} [{r['behavior']:18s}] | Linked: {str(r['is_linked']):5s} | Trade: {r['trade_status']:11s} | {r['latency_ms']:6.1f} ms | Info: {r['reason']}")
        print(f"=========================================================")
        print(f"🚀 Total Concurrent Swarm Time: {t_total:.2f}s | Effective Throughput: {len(swarm)/t_total:.2f} Agent Actions/sec")

if __name__ == "__main__":
    asyncio.run(main())