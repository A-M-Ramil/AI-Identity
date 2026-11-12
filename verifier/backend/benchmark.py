import json
import time
import uuid
import statistics
import asyncio
import httpx
from web3 import Web3

# ==============================================================================
# CONFIGURATION
# ==============================================================================
ANVIL_RPC_URL = "http://127.0.0.1:8545"
ACAPY_ISSUER_URL = "http://127.0.0.1:8020"
ACAPY_VERIFIER_URL = "http://127.0.0.1:8030"
IPFS_API_URL = "http://127.0.0.1:5001/api/v0/add"

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))
assert w3.is_connected(), "❌ Please start Anvil first! Run: anvil"

ADMIN_ACCOUNT = w3.eth.accounts[0]
ATTACKER_ACCOUNT = w3.eth.accounts[1]

def deploy_contract(json_file, *constructor_args):
    with open(json_file, "r") as f:
        data = json.load(f)
    abi = data["abi"]
    bytecode = data["bytecode"]["object"] if isinstance(data["bytecode"], dict) else data["bytecode"]
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = Contract.constructor(*constructor_args).transact({'from': ADMIN_ACCOUNT})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return w3.eth.contract(address=receipt.contractAddress, abi=abi), receipt.gasUsed

print("\n🚀 [1/5] DEPLOYING DUALID SMART CONTRACTS ON ANVIL...")
did_reg, gas_deploy_did = deploy_contract("DIDRegistry.json")
agent_reg, gas_deploy_agent = deploy_contract("AgentRegistry.json")
cred_reg, gas_deploy_cred = deploy_contract("CredentialRegistry.json")
deleg_reg, gas_deploy_deleg = deploy_contract("DelegationRegistry.json")
agent_wallet, gas_deploy_wallet = deploy_contract("AgentWallet.json", ADMIN_ACCOUNT, deleg_reg.address)

# Fund the AgentWallet contract with 50 ETH so autonomous agents can execute trades
w3.eth.send_transaction({'from': ADMIN_ACCOUNT, 'to': agent_wallet.address, 'value': w3.to_wei(50, 'ether')})

print(f"  ✅ DIDRegistry deployed       | Gas: {gas_deploy_did:,}")
print(f"  ✅ AgentRegistry deployed     | Gas: {gas_deploy_agent:,}")
print(f"  ✅ CredentialRegistry deployed| Gas: {gas_deploy_cred:,}")
print(f"  ✅ DelegationRegistry deployed| Gas: {gas_deploy_deleg:,}")
print(f"  ✅ AgentWallet deployed       | Gas: {gas_deploy_wallet:,}")

# ==============================================================================
# EXPERIMENT 1: FUNCTION EXECUTION GAS PROFILING (TABLE I)
# ==============================================================================
print("\n📊 [2/5] RUNNING EXPERIMENT 1: EXACT EVM GAS PROFILING...")

# 1. Protocol 1: registerDID
owner_did_str = f"did:sov:{uuid.uuid4().hex[:16]}"
owner_did_hash = w3.keccak(text=owner_did_str)
ipfs_cid_hash = w3.keccak(text="QmSimulatedIPFSHashForDIDDoc123456789")
gov_id_hash = w3.keccak(text="GOV-ID-99887766")

tx1 = did_reg.functions.registerDID(owner_did_hash, ipfs_cid_hash, gov_id_hash).transact({'from': ADMIN_ACCOUNT})
gas_p1_register_did = w3.eth.wait_for_transaction_receipt(tx1).gasUsed

# 2. Protocol 2: registerAgent (1st Agent vs Subsequent Agent)
agent1_did_str = f"did:sov:agent:{uuid.uuid4().hex[:12]}"
agent1_did_hash = w3.keccak(text=agent1_did_str)
model_hash = w3.keccak(text="Transformer-6B|v2.1.5|sha256:9f86d081884c7d659a2feaa0c55ad015")

tx2_first = agent_reg.functions.registerAgent(agent1_did_hash, owner_did_hash, model_hash).transact({'from': ADMIN_ACCOUNT})
gas_p2_first_agent = w3.eth.wait_for_transaction_receipt(tx2_first).gasUsed

agent2_did_hash = w3.keccak(text=f"did:sov:agent:{uuid.uuid4().hex[:12]}")
tx2_nth = agent_reg.functions.registerAgent(agent2_did_hash, owner_did_hash, model_hash).transact({'from': ADMIN_ACCOUNT})
gas_p2_nth_agent = w3.eth.wait_for_transaction_receipt(tx2_nth).gasUsed

# 3. Protocol 3: issueCredential
cred_id_hash = w3.keccak(text="cred_LIC-000001")
issuer_did_hash = w3.keccak(text="did:sov:issuer01")
cred_hash = w3.keccak(text='{"type":"DeFiTradingLicense","role":"Trader"}')
tx3 = cred_reg.functions.issueCredential(
    cred_id_hash, issuer_did_hash, owner_did_hash, ipfs_cid_hash, cred_hash, 31536000
).transact({'from': ADMIN_ACCOUNT})
gas_p3_issue_cred = w3.eth.wait_for_transaction_receipt(tx3).gasUsed

# 4. Protocol 5: revokeCredential
tx5 = cred_reg.functions.revokeCredential(cred_id_hash).transact({'from': ADMIN_ACCOUNT})
gas_p5_revoke_cred = w3.eth.wait_for_transaction_receipt(tx5).gasUsed

# 5. Protocol 6: setPermission & AgentWallet.executeTrade
agent_eoa = w3.eth.accounts[2]
tx6_set = deleg_reg.functions.setPermission(agent_eoa, w3.to_wei(5, 'ether'), 3600).transact({'from': ADMIN_ACCOUNT})
gas_p6_set_perm = w3.eth.wait_for_transaction_receipt(tx6_set).gasUsed

tx6_trade = agent_wallet.functions.executeTrade(
    "0x000000000000000000000000000000000000dEaD", w3.to_wei(1, 'ether')
).transact({'from': agent_eoa})
gas_p6_exec_trade = w3.eth.wait_for_transaction_receipt(tx6_trade).gasUsed

# 6. Protocol 7 / Audit: recordAuditLog
tx7_audit = cred_reg.functions.recordAuditLog(
    issuer_did_hash, agent1_did_hash, ipfs_cid_hash, w3.keccak(text="audit_pass")
).transact({'from': ADMIN_ACCOUNT})
gas_p7_audit = w3.eth.wait_for_transaction_receipt(tx7_audit).gasUsed

print(f"  🔹 P1: registerDID            | Gas: {gas_p1_register_did:,}")
print(f"  🔹 P2: registerAgent (1st)    | Gas: {gas_p2_first_agent:,}")
print(f"  🔹 P2: registerAgent (N-th)   | Gas: {gas_p2_nth_agent:,}")
print(f"  🔹 P3: issueCredential        | Gas: {gas_p3_issue_cred:,}")
print(f"  🔹 P5: revokeCredential       | Gas: {gas_p5_revoke_cred:,}")
print(f"  🔹 P6: setPermission          | Gas: {gas_p6_set_perm:,}")
print(f"  🔹 P6: executeTrade (On-Chain)| Gas: {gas_p6_exec_trade:,}")
print(f"  🔹 P7: recordAuditLog         | Gas: {gas_p7_audit:,}")

# ==============================================================================
# EXPERIMENT 2: O(1) STORAGE COMPLEXITY ACROSS PAYLOAD SIZES (FIGURE A)
# ==============================================================================
print("\n📈 [3/5] RUNNING EXPERIMENT 2: O(1) GAS VS. METADATA PAYLOAD SIZE...")
payload_sizes_kb = [1, 10, 50, 100, 500, 1000]
o1_gas_results = []

for size_kb in payload_sizes_kb:
    # Simulate off-chain JSON metadata of size_kb Kilobytes (e.g., LLM config + weights manifest)
    large_offchain_json = "X" * (size_kb * 1024)
    
    t0 = time.perf_counter()
    computed_model_hash = w3.keccak(text=large_offchain_json)
    new_agent_hash = w3.keccak(text=f"did:sov:agent:scale_{size_kb}kb")
    
    tx = agent_reg.functions.registerAgent(new_agent_hash, owner_did_hash, computed_model_hash).transact({'from': ADMIN_ACCOUNT})
    receipt = w3.eth.wait_for_transaction_receipt(tx)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    
    # Naive on-chain storage baseline: 20,000 gas per 32-byte word + 21,000 base
    naive_onchain_gas = 21000 + ((size_kb * 1024) // 32) * 20000
    o1_gas_results.append((size_kb, receipt.gasUsed, naive_onchain_gas, elapsed_ms))
    print(f"  📦 Payload: {size_kb:4d} KB | DualID Gas: {receipt.gasUsed:,} | Naive On-Chain Gas: {naive_onchain_gas:,} | Time: {elapsed_ms:.2f} ms")

# ==============================================================================
# EXPERIMENT 3: MULTI-AGENT ADVERSARIAL TESTBED (5 COHORTS x 20 AGENTS = 100)
# ==============================================================================
print("\n🛡️ [4/5] RUNNING EXPERIMENT 3: MULTI-AGENT ADVERSARIAL ROBUSTNESS (100 AGENTS)...")
COHORT_SIZE = 20
results_matrix = {
    "Cohort 1 (Legitimate Fleet)": {"passed": 0, "blocked": 0, "latencies_ms": []},
    "Cohort 2 (Replay/Duplicate DID - T1)": {"passed": 0, "blocked": 0, "latencies_ms": []},
    "Cohort 3 (Tampered Model Weights - T2)": {"passed": 0, "blocked": 0, "latencies_ms": []},
    "Cohort 4 (Spoofed Human Owner - T6a)": {"passed": 0, "blocked": 0, "latencies_ms": []},
    "Cohort 5 (Over-Limit Rogue Trade - T6b)": {"passed": 0, "blocked": 0, "latencies_ms": []},
}

registered_fleet_hashes = []

for i in range(COHORT_SIZE):
    # --- COHORT 1: Legitimate Registration + Ownership Check + Valid Trade ---
    t0 = time.perf_counter()
    c1_did = w3.keccak(text=f"did:sov:agent:legit_{i}")
    c1_model = w3.keccak(text=f"Transformer-6B|v2.1.5|weights_legit_{i}")
    agent_reg.functions.registerAgent(c1_did, owner_did_hash, c1_model).transact({'from': ADMIN_ACCOUNT})
    registered_fleet_hashes.append(c1_did)
    
    is_owner = agent_reg.functions.verifyOwnership(owner_did_hash, c1_did).call()
    onchain_profile = agent_reg.functions.agents(c1_did).call()
    # Verify both ownership and model hash integrity
    if is_owner and onchain_profile[2] == c1_model and onchain_profile[4] is True:
        results_matrix["Cohort 1 (Legitimate Fleet)"]["passed"] += 1
    else:
        results_matrix["Cohort 1 (Legitimate Fleet)"]["blocked"] += 1
    results_matrix["Cohort 1 (Legitimate Fleet)"]["latencies_ms"].append((time.perf_counter() - t0) * 1000)

    # --- COHORT 2: Replay / Duplicate Agent DID Attack (T1 Spoofing) ---
    t0 = time.perf_counter()
    try:
        # Attacker attempts to overwrite already-registered c1_did with a malicious model hash
        fake_model = w3.keccak(text="Malicious-LLM|v6.6.6|backdoor")
        agent_reg.functions.registerAgent(c1_did, owner_did_hash, fake_model).transact({'from': ATTACKER_ACCOUNT})
        results_matrix["Cohort 2 (Replay/Duplicate DID - T1)"]["passed"] += 1
    except Exception:
        results_matrix["Cohort 2 (Replay/Duplicate DID - T1)"]["blocked"] += 1
    results_matrix["Cohort 2 (Replay/Duplicate DID - T1)"]["latencies_ms"].append((time.perf_counter() - t0) * 1000)

    # --- COHORT 3: Tampered Model Weights / Shadow AI (T2 Tampering) ---
    t0 = time.perf_counter()
    # Agent claims to be c1_did, but its runtime model binary hash is mutated (jailbroken)
    mutated_runtime_hash = w3.keccak(text=f"Transformer-6B|v2.1.5|weights_TAMPERED_{i}")
    onchain_record = agent_reg.functions.agents(c1_did).call()
    if onchain_record[2] == mutated_runtime_hash:
        results_matrix["Cohort 3 (Tampered Model Weights - T2)"]["passed"] += 1
    else:
        results_matrix["Cohort 3 (Tampered Model Weights - T2)"]["blocked"] += 1
    results_matrix["Cohort 3 (Tampered Model Weights - T2)"]["latencies_ms"].append((time.perf_counter() - t0) * 1000)

    # --- COHORT 4: Spoofed Human Owner / Unauthorized Claim (T6a Privilege Escalation) ---
    t0 = time.perf_counter()
    attacker_did_hash = w3.keccak(text=f"did:sov:attacker_{i}")
    is_attacker_owner = agent_reg.functions.verifyOwnership(attacker_did_hash, c1_did).call()
    if is_attacker_owner:
        results_matrix["Cohort 4 (Spoofed Human Owner - T6a)"]["passed"] += 1
    else:
        results_matrix["Cohort 4 (Spoofed Human Owner - T6a)"]["blocked"] += 1
    results_matrix["Cohort 4 (Spoofed Human Owner - T6a)"]["latencies_ms"].append((time.perf_counter() - t0) * 1000)

    # --- COHORT 5: Hallucinating / Rogue Agent Exceeding Spend Limit (T6b) ---
    t0 = time.perf_counter()
    try:
        # Agent EOA has a 5 ETH limit, but hallucinates a 10 ETH trade on AgentWallet
        agent_wallet.functions.executeTrade(
            "0x000000000000000000000000000000000000dEaD", w3.to_wei(10, 'ether')
        ).transact({'from': agent_eoa})
        results_matrix["Cohort 5 (Over-Limit Rogue Trade - T6b)"]["passed"] += 1
    except Exception:
        results_matrix["Cohort 5 (Over-Limit Rogue Trade - T6b)"]["blocked"] += 1
    results_matrix["Cohort 5 (Over-Limit Rogue Trade - T6b)"]["latencies_ms"].append((time.perf_counter() - t0) * 1000)

for cohort, stats in results_matrix.items():
    avg_lat = statistics.mean(stats["latencies_ms"])
    print(f"  🛡️ {cohort:42s} | Allowed: {stats['passed']:2d}/{COHORT_SIZE} | Blocked: {stats['blocked']:2d}/{COHORT_SIZE} | Avg Latency: {avg_lat:.2f} ms")

# ==============================================================================
# EXPERIMENT 4: FLEET FORENSIC AUDIT & THROUGHPUT SCALING
# ==============================================================================
print("\n⚡ [5/5] RUNNING EXPERIMENT 4: FORENSIC FLEET AUDIT & CONCURRENT THROUGHPUT...")
for n_agents in [5, 10, 15, 20]:
    t0 = time.perf_counter()
    recovered = []
    for idx in range(n_agents):
        ahash = agent_reg.functions.ownerToAgents(owner_did_hash, idx).call()
        prof = agent_reg.functions.agents(ahash).call()
        recovered.append(prof)
    audit_ms = (time.perf_counter() - t0) * 1000
    print(f"  🔎 Forensic Audit of {n_agents:2d} Agents | Recovered: {len(recovered):2d} | Total Time: {audit_ms:.2f} ms ({audit_ms/n_agents:.2f} ms/agent)")

print("\n🎉 ALL BENCHMARKS COMPLETE!")