import asyncio
import json
import os
import platform
import subprocess
import statistics
import time
import uuid
import httpx
import web3
from web3 import Web3

# ==============================================================================
# CONFIGURATION & ENVIRONMENT METADATA (REQUIREMENT #10)
# ==============================================================================
ANVIL_RPC_URL = "http://127.0.0.1:8545"
ACAPY_ISSUER_URL = "http://127.0.0.1:8020"
ACAPY_VERIFIER_URL = "http://127.0.0.1:8030"
IPFS_API_URL = "http://127.0.0.1:5001/api/v0/add"
IPFS_VERSION_URL = "http://127.0.0.1:5001/api/v0/version"

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))
assert w3.is_connected(), "❌ Start Anvil first! (e.g., anvil)"

OWNER_ACCT = w3.eth.accounts[0]      # Legitimate Human Owner / Authorized Issuer
ATTACKER_ACCT = w3.eth.accounts[1]   # Malicious / Unauthorized EOA

# Cost Assumptions for USD Conversion (Requirement #8)
ETH_PRICE_USD = 2500.0
L1_GAS_PRICE_GWEI = 15.0     # Typical Ethereum L1 Mainnet
L2_GAS_PRICE_GWEI = 0.05     # Typical Optimism / Arbitrum / Base L2

def p95(data):
    s = sorted(data)
    idx = min(len(s) - 1, int(len(s) * 0.95))
    return s[idx]

def gas_to_usd(gas_used, gwei):
    eth_cost = (gas_used * gwei) * 1e-9
    return eth_cost * ETH_PRICE_USD

async def print_environment_report():
    print("======================================================================")
    print("🖥️  [REQUIREMENT #10] EXPERIMENTAL ENVIRONMENT & PROVENANCE REPORT")
    print("======================================================================")
    cpu_info = platform.processor() or "x86_64"
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if "model name" in line:
                    cpu_info = line.split(":")[1].strip()
                    break
    except Exception:
        pass

    anvil_ver = "Unknown"
    try:
        anvil_ver = subprocess.check_output(["anvil", "--version"]).decode().strip()
    except Exception:
        pass

    ipfs_ver, acapy_ver = "Unknown", "Unknown"
    async with httpx.AsyncClient() as client:
        try:
            r_ipfs = await client.post(IPFS_VERSION_URL, timeout=5.0)
            ipfs_ver = r_ipfs.json().get("Version", "Unknown")
        except Exception:
            pass
        try:
            r_aca = await client.get(f"{ACAPY_ISSUER_URL}/status", timeout=5.0)
            acapy_ver = r_aca.json().get("version", "Unknown")
        except Exception:
            pass

    print(f"  • OS / Kernel    : {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"  • CPU            : {cpu_info}")
    print(f"  • Python / Web3  : Python {platform.python_version()} | web3.py v{web3.__version__}")
    print(f"  • Foundry/Anvil  : {anvil_ver} (EVM version: {w3.client_version})")
    print(f"  • ACA-Py Version : v{acapy_ver} (Docker, localhost:8020 & 8030)")
    print(f"  • IPFS Daemon    : Kubo v{ipfs_ver} (Docker, localhost:5001)")
    print("  • Network Scope  : Single-machine localhost (WAN propagation latency excluded)\n")

# ==============================================================================
# DEPLOY CONTRACTS (SUPPORTS BOTH TIER-1 UPGRADED & LEGACY CONSTRUCTORS)
# ==============================================================================
def deploy_contract(json_path, *args):
    with open(json_path, "r") as f:
        data = json.load(f)
    abi = data["abi"]
    bytecode = data["bytecode"]["object"] if isinstance(data["bytecode"], dict) else data["bytecode"]
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = Contract.constructor(*args).transact({'from': OWNER_ACCT})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return w3.eth.contract(address=receipt.contractAddress, abi=abi), receipt.gasUsed, abi

def deploy_all_contracts():
    print("======================================================================")
    print("🚀 [EXPERIMENT 1 & REQ #8] CONTRACT DEPLOYMENT & USD COST PROFILING")
    print("======================================================================")
    did_reg, g_did, _ = deploy_contract("DIDRegistry.json")

    # AgentRegistry may take (address _didRegistry) after Tier-1 upgrade, or ()
    with open("AgentRegistry.json") as f:
        ar_abi = json.load(f)["abi"]
    ar_ctor = next((x for x in ar_abi if x.get("type") == "constructor"), None)
    if ar_ctor and len(ar_ctor.get("inputs", [])) == 1:
        agent_reg, g_agent, _ = deploy_contract("AgentRegistry.json", did_reg.address)
    else:
        agent_reg, g_agent, _ = deploy_contract("AgentRegistry.json")

    # CredentialRegistry may take (address _didRegistry) or ()
    with open("CredentialRegistry.json") as f:
        cr_abi = json.load(f)["abi"]
    cr_ctor = next((x for x in cr_abi if x.get("type") == "constructor"), None)
    if cr_ctor and len(cr_ctor.get("inputs", [])) == 1:
        cred_reg, g_cred, _ = deploy_contract("CredentialRegistry.json", did_reg.address)
    else:
        cred_reg, g_cred, _ = deploy_contract("CredentialRegistry.json")

    deleg_reg, g_deleg, _ = deploy_contract("DelegationRegistry.json")
    agent_wallet, g_wallet, _ = deploy_contract("AgentWallet.json", OWNER_ACCT, deleg_reg.address)

    # Fund AgentWallet with 50 ETH for live on-chain trade execution
    w3.eth.send_transaction({'from': OWNER_ACCT, 'to': agent_wallet.address, 'value': w3.to_wei(50, 'ether')})

    deployments = [
        ("DIDRegistry.sol", g_did),
        ("AgentRegistry.sol", g_agent),
        ("CredentialRegistry.sol", g_cred),
        ("DelegationRegistry.sol", g_deleg),
        ("AgentWallet.sol", g_wallet),
    ]
    for name, gas in deployments:
        print(f"  ✅ {name:24s} | Gas: {gas:7,d} | L1 (15 Gwei): ${gas_to_usd(gas, L1_GAS_PRICE_GWEI):6.2f} | L2 (0.05 Gwei): ${gas_to_usd(gas, L2_GAS_PRICE_GWEI):6.4f}")

    # If CredentialRegistry has addIssuer / setAuthorizedIssuer from Tier-1 upgrade, authorize OWNER_ACCT
    for fn_name in ["authorizeIssuer", "addIssuer", "setIssuer"]:
        if hasattr(cred_reg.functions, fn_name):
            try:
                getattr(cred_reg.functions, fn_name)(OWNER_ACCT).transact({'from': OWNER_ACCT})
            except Exception:
                pass

    return did_reg, agent_reg, cred_reg, deleg_reg, agent_wallet

# ==============================================================================
# REQUIREMENT #7: COMPONENT-LEVEL LATENCY BREAKDOWN (N=30 RUNS PER PROTOCOL)
# ==============================================================================
async def run_component_latency_breakdown(did_reg, agent_reg, cred_reg, deleg_reg, agent_wallet, N=30):
    print("\n======================================================================")
    print(f"⏱️  [REQUIREMENT #7] COMPONENT LATENCY BREAKDOWN (N={N} RUNS PER PROTOCOL)")
    print("======================================================================")

    stats = {
        "P1_registerDID": {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []},
        "P2_registerAgent": {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []},
        "P3_issueCred": {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []},
        "P5_revokeCred": {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []},
        "P6_setPermission": {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []},
        "P6_executeTrade": {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []},
    }

    owner_dids = []
    issued_creds = []

    async with httpx.AsyncClient() as client:
        for i in range(N):
            # --- PROTOCOL 1: Human Identity Registration (ACA-Py + IPFS + Chain) ---
            t_tot0 = time.perf_counter()
            t0 = time.perf_counter()
            r_did = await client.post(f"{ACAPY_ISSUER_URL}/wallet/did/create", json={"method": "sov", "options": {"key_type": "ed25519"}})
            human_did = r_did.json()["result"]["did"]
            verkey = r_did.json()["result"]["verkey"]
            t_aca = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            did_doc = {"@context": "https://www.w3.org/ns/did/v1", "id": f"did:sov:{human_did}", "publicKeyBase58": verkey}
            r_ipfs = await client.post(IPFS_API_URL, files={"file": json.dumps(did_doc)})
            cid = r_ipfs.json()["Hash"]
            t_ipfs = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            did_h = w3.keccak(text=human_did)
            cid_h = w3.keccak(text=cid)
            # Salted government ID hash to prevent rainbow-table brute forcing!
            gov_h = w3.keccak(text=f"GOV-{i}|salt:{uuid.uuid4().hex}")
            tx = did_reg.functions.registerDID(did_h, cid_h, gov_h).transact({'from': OWNER_ACCT})
            rec = w3.eth.wait_for_transaction_receipt(tx)
            t_chain = (time.perf_counter() - t0) * 1000

            owner_dids.append(did_h)
            stats["P1_registerDID"]["acapy"].append(t_aca)
            stats["P1_registerDID"]["ipfs"].append(t_ipfs)
            stats["P1_registerDID"]["chain"].append(t_chain)
            stats["P1_registerDID"]["total"].append((time.perf_counter() - t_tot0) * 1000)
            stats["P1_registerDID"]["gas"].append(rec.gasUsed)

            # --- PROTOCOL 2: AI Agent Registration (ACA-Py + IPFS + Chain) ---
            t_tot0 = time.perf_counter()
            t0 = time.perf_counter()
            r_adid = await client.post(f"{ACAPY_VERIFIER_URL}/wallet/did/create", json={"method": "sov", "options": {"key_type": "ed25519"}})
            agent_did = r_adid.json()["result"]["did"]
            t_aca = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            agent_meta = {"agentDID": agent_did, "ownerDID": human_did, "arch": "Llama-3-8B", "ver": "1.0"}
            r_aipfs = await client.post(IPFS_API_URL, files={"file": json.dumps(agent_meta)})
            acid = r_aipfs.json()["Hash"]
            t_ipfs = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            adid_h = w3.keccak(text=agent_did)
            model_h = w3.keccak(text=f"Llama-3-8B|1.0|{acid}")
            tx = agent_reg.functions.registerAgent(adid_h, did_h, model_h).transact({'from': OWNER_ACCT})
            rec = w3.eth.wait_for_transaction_receipt(tx)
            t_chain = (time.perf_counter() - t0) * 1000

            stats["P2_registerAgent"]["acapy"].append(t_aca)
            stats["P2_registerAgent"]["ipfs"].append(t_ipfs)
            stats["P2_registerAgent"]["chain"].append(t_chain)
            stats["P2_registerAgent"]["total"].append((time.perf_counter() - t_tot0) * 1000)
            stats["P2_registerAgent"]["gas"].append(rec.gasUsed)

            # --- PROTOCOL 3: Credential Issuance (IPFS + Chain) ---
            t_tot0 = time.perf_counter()
            t0 = time.perf_counter()
            vc_payload = {"id": f"urn:uuid:{uuid.uuid4()}", "issuer": human_did, "subject": agent_did, "role": "DeFiTrader"}
            r_vcipfs = await client.post(IPFS_API_URL, files={"file": json.dumps(vc_payload)})
            vc_cid = r_vcipfs.json()["Hash"]
            t_ipfs = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            cred_id_h = w3.keccak(text=f"cred_LIC-{i}-{uuid.uuid4().hex[:6]}")
            tx = cred_reg.functions.issueCredential(
                cred_id_h, did_h, adid_h, w3.keccak(text=vc_cid), w3.keccak(text=json.dumps(vc_payload)), 31536000
            ).transact({'from': OWNER_ACCT})
            rec = w3.eth.wait_for_transaction_receipt(tx)
            t_chain = (time.perf_counter() - t0) * 1000

            issued_creds.append(cred_id_h)
            stats["P3_issueCred"]["acapy"].append(0.0)
            stats["P3_issueCred"]["ipfs"].append(t_ipfs)
            stats["P3_issueCred"]["chain"].append(t_chain)
            stats["P3_issueCred"]["total"].append((time.perf_counter() - t_tot0) * 1000)
            stats["P3_issueCred"]["gas"].append(rec.gasUsed)

            # --- PROTOCOL 5: Real On-Chain Credential Revocation (IPFS + Chain) ---
            t_tot0 = time.perf_counter()
            t0 = time.perf_counter()
            rev_doc = {"credID": cred_id_h.hex(), "reason": "privilegeWithdrawn", "timestamp": time.time()}
            await client.post(IPFS_API_URL, files={"file": json.dumps(rev_doc)})
            t_ipfs = (time.perf_counter() - t0) * 1000

            t0 = time.perf_counter()
            tx = cred_reg.functions.revokeCredential(cred_id_h).transact({'from': OWNER_ACCT})
            rec = w3.eth.wait_for_transaction_receipt(tx)
            t_chain = (time.perf_counter() - t0) * 1000

            stats["P5_revokeCred"]["acapy"].append(0.0)
            stats["P5_revokeCred"]["ipfs"].append(t_ipfs)
            stats["P5_revokeCred"]["chain"].append(t_chain)
            stats["P5_revokeCred"]["total"].append((time.perf_counter() - t_tot0) * 1000)
            stats["P5_revokeCred"]["gas"].append(rec.gasUsed)

            # --- PROTOCOL 6: Set Permission & Execute On-Chain Trade via AgentWallet ---
            agent_eoa = w3.eth.accounts[2]
            t_tot0 = time.perf_counter()
            t0 = time.perf_counter()
            tx = deleg_reg.functions.setPermission(agent_eoa, w3.to_wei(2, 'ether'), 3600).transact({'from': OWNER_ACCT})
            rec = w3.eth.wait_for_transaction_receipt(tx)
            t_chain = (time.perf_counter() - t0) * 1000
            stats["P6_setPermission"]["acapy"].append(0.0)
            stats["P6_setPermission"]["ipfs"].append(0.0)
            stats["P6_setPermission"]["chain"].append(t_chain)
            stats["P6_setPermission"]["total"].append((time.perf_counter() - t_tot0) * 1000)
            stats["P6_setPermission"]["gas"].append(rec.gasUsed)

            t_tot0 = time.perf_counter()
            t0 = time.perf_counter()
            tx = agent_wallet.functions.executeTrade(
                "0x000000000000000000000000000000000000dEaD", w3.to_wei(0.05, 'ether')
            ).transact({'from': agent_eoa})
            rec = w3.eth.wait_for_transaction_receipt(tx)
            t_chain = (time.perf_counter() - t0) * 1000
            stats["P6_executeTrade"]["acapy"].append(0.0)
            stats["P6_executeTrade"]["ipfs"].append(0.0)
            stats["P6_executeTrade"]["chain"].append(t_chain)
            stats["P6_executeTrade"]["total"].append((time.perf_counter() - t_tot0) * 1000)
            stats["P6_executeTrade"]["gas"].append(rec.gasUsed)

    print(f"  {'Operation':18s} | {'Gas (Mean)':10s} | {'ACA-Py (ms)':13s} | {'IPFS (ms)':13s} | {'Chain (ms)':13s} | {'Total (Mean ± SD)':19s} | {'p95 (ms)':8s}")
    print("  " + "-"*108)
    for name, d in stats.items():
        g_mean = int(statistics.mean(d["gas"]))
        aca_m = statistics.mean(d["acapy"])
        ipfs_m = statistics.mean(d["ipfs"])
        ch_m = statistics.mean(d["chain"])
        tot_m = statistics.mean(d["total"])
        tot_sd = statistics.stdev(d["total"])
        tot_p95 = p95(d["total"])
        print(f"  {name:18s} | {g_mean:10,d} | {aca_m:10.2f} ms | {ipfs_m:10.2f} ms | {ch_m:10.2f} ms | {tot_m:7.2f} ± {tot_sd:5.2f} ms | {tot_p95:6.2f} ms")

    return owner_dids[0]

# ==============================================================================
# REQUIREMENT #2: NON-TAUTOLOGICAL SECURITY SCENARIO EVALUATION (N=20 EACH)
# ==============================================================================
def run_non_tautological_security_tests(did_reg, agent_reg, cred_reg, deleg_reg, agent_wallet, victim_owner_did_hash, N=20):
    print("\n======================================================================")
    print(f"🛡️  [REQUIREMENT #2] NON-TAUTOLOGICAL SECURITY EVALUATION (N={N} SCENARIOS)")
    print("======================================================================")

    scenarios = {
        "S1: Non-Issuer Revokes Credential (msg.sender != issuer)": {"blocked": 0, "total": N},
        "S2: Unauthorized Caller Issues Credential": {"blocked": 0, "total": N},
        "S3: Register Agent Under Victim's Owner DID": {"blocked": 0, "total": N},
        "S4: Use Revoked Credential End-to-End": {"blocked": 0, "total": N},
        "S5: Trade After Delegation Revoked/Expired": {"blocked": 0, "total": N},
        "S6: Trade Above Delegated Spend Limit": {"blocked": 0, "total": N},
    }

    for i in range(N):
        # Issue a valid credential as OWNER_ACCT first
        valid_cred_id = w3.keccak(text=f"sec_cred_{i}_{uuid.uuid4().hex}")
        cred_reg.functions.issueCredential(
            valid_cred_id, victim_owner_did_hash, w3.keccak(text=f"holder_{i}"),
            w3.keccak(text="QmCID"), w3.keccak(text="Hash"), 31536000
        ).transact({'from': OWNER_ACCT})

        # --- S1: Non-Issuer (ATTACKER_ACCT) Attempts to Revoke OWNER_ACCT's Credential ---
        try:
            cred_reg.functions.revokeCredential(valid_cred_id).transact({'from': ATTACKER_ACCT})
        except Exception:
            scenarios["S1: Non-Issuer Revokes Credential (msg.sender != issuer)"]["blocked"] += 1

        # --- S2: Unauthorized Caller (ATTACKER_ACCT) Attempts to Issue Credential ---
        try:
            fake_cred_id = w3.keccak(text=f"fake_cred_{i}_{uuid.uuid4().hex}")
            attacker_did_hash = w3.keccak(text=f"unregistered_issuer_{i}")
            cred_reg.functions.issueCredential(
                fake_cred_id, attacker_did_hash, w3.keccak(text=f"holder_{i}"),
                w3.keccak(text="QmCID"), w3.keccak(text="Hash"), 31536000
            ).transact({'from': ATTACKER_ACCT})
        except Exception:
            scenarios["S2: Unauthorized Caller Issues Credential"]["blocked"] += 1

        # --- S3: Attacker Attempts to Register Agent Under Victim's Owner DID ---
        try:
            rogue_agent_did = w3.keccak(text=f"rogue_agent_{i}_{uuid.uuid4().hex}")
            agent_reg.functions.registerAgent(
                rogue_agent_did, victim_owner_did_hash, w3.keccak(text="malicious_model")
            ).transact({'from': ATTACKER_ACCT})
        except Exception:
            scenarios["S3: Register Agent Under Victim's Owner DID"]["blocked"] += 1

        # --- S4: Legitimate Issuer Revokes Credential -> Holder Attempts Verification ---
        cred_reg.functions.revokeCredential(valid_cred_id).transact({'from': OWNER_ACCT})
        is_valid, status_str = cred_reg.functions.verifyCredential(valid_cred_id).call()
        if (not is_valid) and status_str == "Revoked":
            scenarios["S4: Use Revoked Credential End-to-End"]["blocked"] += 1

        # --- S5: Owner Revokes Delegation -> Agent Attempts Trade via AgentWallet ---
        rogue_eoa = w3.eth.accounts[3]
        # First grant, then immediately revoke (either via revokePermission or setting limit=0, duration=0)
        deleg_reg.functions.setPermission(rogue_eoa, w3.to_wei(1, 'ether'), 3600).transact({'from': OWNER_ACCT})
        if hasattr(deleg_reg.functions, "revokePermission"):
            deleg_reg.functions.revokePermission(rogue_eoa).transact({'from': OWNER_ACCT})
        else:
            deleg_reg.functions.setPermission(rogue_eoa, 0, 0).transact({'from': OWNER_ACCT})

        try:
            agent_wallet.functions.executeTrade(
                "0x000000000000000000000000000000000000dEaD", w3.to_wei(0.1, 'ether')
            ).transact({'from': rogue_eoa})
        except Exception:
            scenarios["S5: Trade After Delegation Revoked/Expired"]["blocked"] += 1

        # --- S6: Agent Attempts Trade Above Limit via AgentWallet ---
        limited_eoa = w3.eth.accounts[4]
        deleg_reg.functions.setPermission(limited_eoa, w3.to_wei(0.5, 'ether'), 3600).transact({'from': OWNER_ACCT})
        try:
            agent_wallet.functions.executeTrade(
                "0x000000000000000000000000000000000000dEaD", w3.to_wei(1.5, 'ether')
            ).transact({'from': limited_eoa})
        except Exception:
            scenarios["S6: Trade Above Delegated Spend Limit"]["blocked"] += 1

    for s_name, res in scenarios.items():
        rate = (res["blocked"] / res["total"]) * 100
        print(f"  🛡️ {s_name:58s} | Blocked: {res['blocked']:2d}/{res['total']:2d} ({rate:5.1f}%)")

# ==============================================================================
# REQUIREMENT #6: FIXED CONCURRENT SCALING WITH asyncio.to_thread + AgentWallet
# ==============================================================================
async def run_fixed_scaling_experiment(deleg_reg, agent_wallet):
    print("\n======================================================================")
    print("⚡ [REQUIREMENT #6] NON-BLOCKING CONCURRENT SCALING (asyncio.to_thread)")
    print("======================================================================")
    cohort_sizes = [5, 10, 25, 50]

    # Create 50 distinct EOA signers, fund them for gas, and authorize them on DelegationRegistry
    print("  [Setup] Provisioning 50 distinct Agent EOAs with independent nonces...")
    agent_signers = [w3.eth.account.create() for _ in range(50)]
    for acct in agent_signers:
        w3.eth.send_transaction({'from': OWNER_ACCT, 'to': acct.address, 'value': w3.to_wei(0.2, 'ether')})
        deleg_reg.functions.setPermission(acct.address, w3.to_wei(5.0, 'ether'), 3600).transact({'from': OWNER_ACCT})

    def sync_agent_wallet_trade(acct):
        t0 = time.perf_counter()
        nonce = w3.eth.get_transaction_count(acct.address, 'pending')
        tx = agent_wallet.functions.executeTrade(
            "0x000000000000000000000000000000000000dEaD", w3.to_wei(0.01, 'ether')
        ).build_transaction({
            'from': acct.address,
            'nonce': nonce,
            'gas': 120000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        signed = w3.eth.account.sign_transaction(tx, acct.key)
        raw = signed.rawTransaction if hasattr(signed, "rawTransaction") else signed.raw_transaction
        tx_hash = w3.eth.send_raw_transaction(raw)
        rec = w3.eth.wait_for_transaction_receipt(tx_hash)
        return (time.perf_counter() - t0) * 1000, rec.status == 1

    for n in cohort_sizes:
        subset = agent_signers[:n]
        t_start = time.perf_counter()
        # Use asyncio.to_thread so all N agent transactions dispatch across worker threads concurrently
        results = await asyncio.gather(*(asyncio.to_thread(sync_agent_wallet_trade, a) for a in subset))
        elapsed = time.perf_counter() - t_start

        lats = [r[0] for r in results if r[1]]
        ok = sum(1 for r in results if r[1])
        tps = ok / elapsed
        print(f"  🚀 N={n:2d} Concurrent Agents | Throughput: {tps:6.1f} TPS | Latency: Mean {statistics.mean(lats):6.1f} ± {statistics.stdev(lats):5.1f} ms | p95: {p95(lats):6.1f} ms | Success: {ok}/{n}")

async def main():
    await print_environment_report()
    did_reg, agent_reg, cred_reg, deleg_reg, agent_wallet = deploy_all_contracts()
    victim_did_hash = await run_component_latency_breakdown(did_reg, agent_reg, cred_reg, deleg_reg, agent_wallet, N=30)
    run_non_tautological_security_tests(did_reg, agent_reg, cred_reg, deleg_reg, agent_wallet, victim_did_hash, N=20)
    await run_fixed_scaling_experiment(deleg_reg, agent_wallet)
    print("\n🎉 ALL TIER-1 & TIER-2 EVALUATIONS COMPLETE!")

if __name__ == "__main__":
    asyncio.run(main())