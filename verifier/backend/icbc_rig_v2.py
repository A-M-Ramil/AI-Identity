"""
icbc_rig_v2.py - evaluation rig for the DualID prototype.

Differences from v1:
  * Strict deployment: asserts the freshly built ABIs have the expected
    constructors/functions (no silent legacy fallbacks). Prints a bytecode
    fingerprint per contract so stale builds are obvious.
  * Security scenarios check the REVERT REASON, force the reverted tx to be
    mined (receipt.status == 0) and assert that contract STATE did not change.
    Each scenario also runs a positive control where applicable.
  * Every transaction waits for its receipt before any dependent read.
  * Gas profiling reports first-use vs steady-state cost, plus per-op USD.
  * Latency: warm-up iterations discarded; mean / median / SD / p95.
  * Scaling: repeated runs per N (mean +- SD of TPS); optional API-path
    scaling through the live FastAPI verifier (--api).
  * Results are written to icbc_results.json.

Usage examples:
  python icbc_rig_v2.py                                   # automine run
  python icbc_rig_v2.py --label "block-time=2s"           # after: anvil --block-time 2
  python icbc_rig_v2.py --api --owner-did 8jMaEBx4cqXoXtJUW5PVnc
"""
import argparse
import asyncio
import hashlib
import json
import platform
import statistics
import subprocess
import time
import uuid

import httpx
import web3
from eth_abi import encode as abi_encode
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3
from web3.exceptions import ContractLogicError

# ==============================================================================
# CONFIG
# ==============================================================================
ANVIL_RPC_URL = "http://127.0.0.1:8545"
ACAPY_ISSUER_URL = "http://127.0.0.1:8020"
ACAPY_VERIFIER_URL = "http://127.0.0.1:8030"
VERIFIER_API_URL = "http://127.0.0.1:8012"
IPFS_API_URL = "http://127.0.0.1:5001/api/v0/add"
IPFS_VERSION_URL = "http://127.0.0.1:5001/api/v0/version"

# Expected revert reasons. If you change a require() message in Solidity,
# change it here too; a mismatch shows up as a FAILED scenario with the
# observed reason printed.
REASONS = {
    "not_issuer": "Not authorized issuer",
    "cred_exists": "Credential already exists",
    "not_owner_did": "Caller does not own ownerDID",
    "agent_exists": "Agent DID already exists",
    "access_denied": "ACCESS DENIED",
    "no_delegation": "No active delegation",
    "not_registered": "AGENT NOT REGISTERED",
    "bad_agent_sig": "Invalid agent signature",
}

# USD conversion assumptions (inputs, not measurements)
ETH_PRICE_USD = 2500.0
L1_GAS_PRICE_GWEI = 15.0
L2_GAS_PRICE_GWEI = 0.05

DEAD = Web3.to_checksum_address("0x000000000000000000000000000000000000dEaD")

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))
assert w3.is_connected(), "Start Anvil first (e.g. `anvil`)"

OWNER = w3.eth.accounts[0]       # human owner AND authorized issuer
ATTACKER = w3.eth.accounts[1]    # unauthorized EOA
A_CONTROL = w3.eth.accounts[2]   # agent EOAs used by the delegation scenarios
A_REVOKE = w3.eth.accounts[3]
A_LIMIT = w3.eth.accounts[4]
A_EXPIRE = w3.eth.accounts[5]
A_NONOWNER = w3.eth.accounts[6]

RESULTS = {}
RIG = {}                         # shared rig state (owner DID that the fixed agents are bound to)
BINDING_TAG = Web3.keccak(text="DualID.AgentBinding.v1")


# ==============================================================================
# HELPERS
# ==============================================================================
def gas_usd(gas, gwei):
    return gas * gwei * 1e-9 * ETH_PRICE_USD


def summarize(xs):
    xs = list(xs)
    if not xs:
        return {"n": 0, "mean": 0, "median": 0, "sd": 0, "p95": 0}
    s = sorted(xs)
    return {
        "n": len(xs),
        "mean": statistics.mean(xs),
        "median": statistics.median(xs),
        "sd": statistics.stdev(xs) if len(xs) > 1 else 0.0,
        "p95": s[min(len(s) - 1, int(len(s) * 0.95))],
    }


def _addr(sender):
    return sender.address if hasattr(sender, "key") else sender


def send(fn, sender, gas=None):
    """Transact and WAIT for the receipt. sender: unlocked Anvil address or LocalAccount."""
    if hasattr(sender, "key"):
        tx = fn.build_transaction({
            "from": sender.address,
            "nonce": w3.eth.get_transaction_count(sender.address, "pending"),
            "gas": gas or 500000,
            "gasPrice": w3.to_wei("1", "gwei")})
        signed = w3.eth.account.sign_transaction(tx, sender.key)
        raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
        h = w3.eth.send_raw_transaction(raw)
    else:
        params = {"from": sender}
        if gas:
            params["gas"] = gas
        h = fn.transact(params)
    return w3.eth.wait_for_transaction_receipt(h)


def fund(addr, eth=1.0):
    rec = w3.eth.wait_for_transaction_receipt(
        w3.eth.send_transaction({"from": OWNER, "to": addr, "value": w3.to_wei(eth, "ether")}))
    assert rec.status == 1


def binding_digest(agent_reg, agent_did, owner_did, model_hash, agent_addr):
    """Must equal AgentRegistry.bindingDigest (checked once at deployment)."""
    return Web3.keccak(abi_encode(
        ["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32", "address"],
        [BINDING_TAG, w3.eth.chain_id, agent_reg.address, agent_did, owner_did, model_hash, agent_addr]))


def agent_signature(digest, addr, key=None):
    """Agent proof of possession: local key if given, else eth_sign by the unlocked Anvil account."""
    if key is not None:
        return Account.sign_message(encode_defunct(primitive=digest), private_key=key).signature
    return w3.eth.sign(addr, data=digest)


def register_agent_fn(agent_reg, owner_did, addr, key=None, agent_did=None, model_hash=None, sig_by=None):
    """Build registerAgent(...). sig_by=(addr, key) lets a DIFFERENT key sign (forged-consent test)."""
    agent_did = agent_did if agent_did is not None else w3.keccak(text=f"agent_{uuid.uuid4().hex}")
    model_hash = model_hash if model_hash is not None else w3.keccak(text="model")
    s_addr, s_key = sig_by if sig_by is not None else (addr, key)
    sig = agent_signature(binding_digest(agent_reg, agent_did, owner_did, model_hash, addr), s_addr, s_key)
    return agent_reg.functions.registerAgent(agent_did, owner_did, model_hash, addr, sig), agent_did


def must(fn, sender, gas=None):
    rec = send(fn, sender, gas)
    assert rec.status == 1, f"Unexpected revert for legitimate call from {sender}"
    return rec


def attack(fn, sender, expect_reason, state_unchanged):
    """
    Returns (blocked: bool, observed_reason: str).
    blocked requires ALL of:
      1. eth_call simulation reverts with the expected reason
      2. the transaction, forced onto the chain with explicit gas, is mined
         with status 0
      3. state_unchanged() is True afterwards
    """
    try:
        fn.call({"from": _addr(sender)})
        sim_ok, reason = False, "(call succeeded: attack would work)"
    except Exception as e:  # ContractLogicError or RPC error; judged by reason
        reason = str(e)
        sim_ok = expect_reason in reason
    rec = send(fn, sender, gas=500000)
    mined_reverted = rec.status == 0
    return (sim_ok and mined_reverted and bool(state_unchanged())), reason


def abi_names(abi):
    return {x.get("name") for x in abi if x.get("type") == "function"}


def load_artifact(path):
    with open(path) as f:
        d = json.load(f)
    bytecode = d["bytecode"]["object"] if isinstance(d["bytecode"], dict) else d["bytecode"]
    return d["abi"], bytecode, d


def fingerprint(bytecode):
    return hashlib.sha256(bytecode.encode()).hexdigest()[:12]


# ==============================================================================
# ENVIRONMENT REPORT
# ==============================================================================
async def environment_report(label):
    print("=" * 78)
    print("EXPERIMENTAL ENVIRONMENT")
    print("=" * 78)
    cpu = platform.processor() or "x86_64"
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if "model name" in line:
                    cpu = line.split(":")[1].strip()
                    break
    except Exception:
        pass
    anvil = "unknown"
    try:
        anvil = subprocess.check_output(["anvil", "--version"]).decode().splitlines()[0]
    except Exception:
        pass
    evm = "unknown"
    try:
        _, _, d = load_artifact("CredentialRegistry.json")
        evm = d["metadata"]["settings"]["evmVersion"]
        solc = d["metadata"]["compiler"]["version"]
    except Exception:
        solc = "unknown"
    ipfs_ver, acapy_ver = "unknown", "unknown"
    async with httpx.AsyncClient() as c:
        try:
            ipfs_ver = (await c.post(IPFS_VERSION_URL, timeout=5)).json().get("Version", "unknown")
        except Exception:
            pass
        try:
            acapy_ver = (await c.get(f"{ACAPY_ISSUER_URL}/status", timeout=5)).json().get("version", "unknown")
        except Exception:
            pass
    try:
        automine = w3.provider.make_request("anvil_getAutomine", []).get("result")
    except Exception:
        automine = "unknown"
    if automine is True and "block-time" in label:
        print("  WARNING: label says block-time but Anvil is in AUTOMINE mode.")
        print("           Restart with `anvil --block-time 2` or the numbers are mislabelled.\n")
    env = {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu": cpu,
        "python": platform.python_version(),
        "web3py": web3.__version__,
        "anvil": anvil,
        "solc": solc,
        "evm_target": evm,
        "acapy": acapy_ver,
        "kubo": ipfs_ver,
        "chain_mode": label,
        "anvil_automine": automine,
        "scope": "single machine, localhost, WAN latency excluded",
    }
    for k, v in env.items():
        print(f"  {k:12s}: {v}")
    print()
    RESULTS["environment"] = env


# ==============================================================================
# STRICT DEPLOYMENT
# ==============================================================================
def deploy(path, expect_fns, ctor_inputs, *args):
    abi, bytecode, _ = load_artifact(path)
    missing = set(expect_fns) - abi_names(abi)
    if missing:
        raise SystemExit(
            f"\n{path} is STALE or wrong: missing functions {sorted(missing)}.\n"
            f"Run `forge build` and copy the fresh JSON from out/ before re-running."
        )
    ctor = next((x for x in abi if x.get("type") == "constructor"), None)
    n_in = len(ctor["inputs"]) if ctor else 0
    if n_in != ctor_inputs:
        raise SystemExit(
            f"\n{path} constructor takes {n_in} args, rig expects {ctor_inputs}. "
            f"Stale build or contract changed; fix the artifact or the rig."
        )
    C = w3.eth.contract(abi=abi, bytecode=bytecode)
    rec = w3.eth.wait_for_transaction_receipt(C.constructor(*args).transact({"from": OWNER}))
    assert rec.status == 1, f"{path} deployment reverted"
    print(f"  {path:26s} bytecode sha256[:12]={fingerprint(bytecode)}  deploy gas={rec.gasUsed:,}")
    return w3.eth.contract(address=rec.contractAddress, abi=abi), rec.gasUsed


def deploy_all():
    print("=" * 78)
    print("CONTRACT DEPLOYMENT (strict: stale artifacts abort the run)")
    print("=" * 78)
    did_reg, g1 = deploy("DIDRegistry.json", ["registerDID", "verifyOwnership"], 0)
    agent_reg, g2 = deploy(
        "AgentRegistry.json",
        ["registerAgent", "verifyOwnership", "agents", "ownerToAgents", "didRegistry",
         "isAgentOf", "deactivateAgent", "bindingDigest", "agentDIDByAddress"],
        1, did_reg.address,
    )
    cred_reg, g3 = deploy(
        "CredentialRegistry.json",
        ["issuer", "issueCredential", "revokeCredential", "verifyCredential", "credentials"],
        0,
    )
    deleg_reg, g4 = deploy(
        "DelegationRegistry.json",
        ["setPermission", "revokePermission", "checkPermission", "permissions"],
        0,
    )
    wallet, g5 = deploy("AgentWallet.json", ["executeTrade", "agentRegistry"], 3,
                        OWNER, deleg_reg.address, agent_reg.address)

    assert cred_reg.functions.issuer().call() == OWNER, "issuer() is not the owner account"
    if w3.eth.get_balance(OWNER) < w3.to_wei(200, "ether"):
        raise SystemExit("Account 0 is nearly drained. Restart Anvil (fresh chain) and re-run.")
    frec = w3.eth.wait_for_transaction_receipt(
        w3.eth.send_transaction({"from": OWNER, "to": wallet.address, "value": w3.to_wei(100, "ether")}))
    assert frec.status == 1, "AgentWallet funding tx reverted"
    assert w3.eth.get_balance(wallet.address) >= w3.to_wei(100, "ether"), "AgentWallet not funded"
    print(f"  AgentWallet funded: {w3.from_wei(w3.eth.get_balance(wallet.address), 'ether')} ETH")

    probe = (w3.keccak(text="p1"), w3.keccak(text="p2"), w3.keccak(text="p3"), A_CONTROL)
    assert bytes(agent_reg.functions.bindingDigest(*probe).call()) == bytes(binding_digest(agent_reg, *probe)), \
        "Agent binding digest mismatch between Python and Solidity"
    owner_did = w3.keccak(text=f"rig_owner_{uuid.uuid4().hex}")
    must(did_reg.functions.registerDID(owner_did, w3.keccak(text="cid"), w3.keccak(text=f"gov_{uuid.uuid4().hex}")), OWNER)
    RIG["owner_did"] = owner_did
    for a in (A_CONTROL, A_REVOKE, A_LIMIT, A_EXPIRE):
        fn, _ = register_agent_fn(agent_reg, owner_did, a)
        must(fn, OWNER)
    print("  Binding digest Python == Solidity; fixed agent accounts bound in AgentRegistry\n")

    RESULTS["deployment_gas"] = {
        "DIDRegistry": g1, "AgentRegistry": g2, "CredentialRegistry": g3,
        "DelegationRegistry": g4, "AgentWallet": g5,
    }
    return did_reg, agent_reg, cred_reg, deleg_reg, wallet


# ==============================================================================
# EXPERIMENT 1: GAS PROFILE (first-use vs steady state) + USD
# ==============================================================================
def gas_profile(did_reg, agent_reg, cred_reg, deleg_reg, wallet):
    print("=" * 78)
    print("GAS PROFILE (first use vs steady state)")
    print("=" * 78)
    rows = []

    def rec_row(name, gas, note=""):
        rows.append({"op": name, "gas": gas, "note": note})
        print(f"  {name:44s} {gas:9,d} gas | L1 ${gas_usd(gas, L1_GAS_PRICE_GWEI):6.2f} | "
              f"L2 ${gas_usd(gas, L2_GAS_PRICE_GWEI):7.4f}  {note}")

    owner_did = w3.keccak(text=f"gp_owner_{uuid.uuid4().hex}")
    r = must(did_reg.functions.registerDID(owner_did, w3.keccak(text="cid"), w3.keccak(text=f"gov_{uuid.uuid4().hex}")), OWNER)
    rec_row("P1 registerDID", r.gasUsed)

    mh = w3.keccak(text="model")
    k1, k2 = Account.create(), Account.create()
    fn, a1 = register_agent_fn(agent_reg, owner_did, k1.address, k1.key, model_hash=mh)
    r = must(fn, OWNER)
    rec_row("P2 registerAgent (owner's 1st agent)", r.gasUsed, "new array slot + sig check")
    fn, a2 = register_agent_fn(agent_reg, owner_did, k2.address, k2.key, model_hash=mh)
    r = must(fn, OWNER)
    rec_row("P2 registerAgent (owner's 2nd+ agent)", r.gasUsed, "sig check")
    r = must(agent_reg.functions.deactivateAgent(a2), OWNER)
    rec_row("P2 deactivateAgent", r.gasUsed)

    cid = w3.keccak(text=f"gp_cred_{uuid.uuid4().hex}")
    r = must(cred_reg.functions.issueCredential(cid, owner_did, a1, w3.keccak(text="c"), w3.keccak(text="h"), 31536000), OWNER)
    rec_row("P3 issueCredential", r.gasUsed)
    r = must(cred_reg.functions.revokeCredential(cid), OWNER)
    rec_row("P5 revokeCredential", r.gasUsed)

    fresh_agent = w3.eth.account.create().address
    r = must(deleg_reg.functions.setPermission(fresh_agent, w3.to_wei(1, "ether"), 3600), OWNER)
    rec_row("P6 setPermission (fresh agent)", r.gasUsed, "new storage slots")
    r = must(deleg_reg.functions.setPermission(fresh_agent, w3.to_wei(1, "ether"), 3600), OWNER)
    rec_row("P6 setPermission (update existing)", r.gasUsed, "slot rewrite")
    r = must(deleg_reg.functions.revokePermission(fresh_agent), OWNER)
    rec_row("P6 revokePermission", r.gasUsed)

    must(deleg_reg.functions.setPermission(A_CONTROL, w3.to_wei(5, "ether"), 36000), OWNER)
    new_recipient = Web3.to_checksum_address(w3.eth.account.create().address)
    r = must(wallet.functions.executeTrade(new_recipient, w3.to_wei(0.01, "ether")), A_CONTROL, gas=200000)
    rec_row("P6 executeTrade (new recipient account)", r.gasUsed, "includes new-account cost")
    r1 = must(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_CONTROL, gas=200000)
    r2 = must(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_CONTROL, gas=200000)
    rec_row("P6 executeTrade (burn addr, 1st call)", r1.gasUsed, "may include new-account cost")
    rec_row("P6 executeTrade (burn addr, steady)", r2.gasUsed)

    print("\n  USD assumptions: ETH=$%.0f, L1=%.1f gwei, L2=%.2f gwei. L2 figure is execution gas only" %
          (ETH_PRICE_USD, L1_GAS_PRICE_GWEI, L2_GAS_PRICE_GWEI))
    print("  (excludes L1 data-posting cost). These are inputs, not measurements.\n")
    RESULTS["gas_profile"] = rows


# ==============================================================================
# EXPERIMENT 2: SECURITY SCENARIOS
# ==============================================================================
def security_scenarios(did_reg, agent_reg, cred_reg, deleg_reg, wallet, repeats):
    print("=" * 78)
    print(f"SECURITY SCENARIOS (revert reason + mined status 0 + state unchanged; {repeats} repeats)")
    print("=" * 78)

    owner_did = w3.keccak(text=f"sec_owner_{uuid.uuid4().hex}")
    must(did_reg.functions.registerDID(owner_did, w3.keccak(text="cid"), w3.keccak(text=f"gov_{uuid.uuid4().hex}")), OWNER)

    def new_cred():
        cid = w3.keccak(text=f"sec_cred_{uuid.uuid4().hex}")
        must(cred_reg.functions.issueCredential(
            cid, owner_did, w3.keccak(text="holder"), w3.keccak(text="cid"), w3.keccak(text="h"), 31536000), OWNER)
        return cid

    def wallet_bal():
        return w3.eth.get_balance(wallet.address)

    def scn_s1():  # non-issuer revokes
        cid = new_cred()
        b, r = attack(cred_reg.functions.revokeCredential(cid), ATTACKER, REASONS["not_issuer"],
                      lambda: tuple(cred_reg.functions.verifyCredential(cid).call()) == (True, "Valid"))
        return b, r, True

    def scn_s2():  # non-issuer issues
        cid = w3.keccak(text=f"sec_fake_{uuid.uuid4().hex}")
        b, r = attack(
            cred_reg.functions.issueCredential(cid, owner_did, w3.keccak(text="h"), w3.keccak(text="c"), w3.keccak(text="x"), 31536000),
            ATTACKER, REASONS["not_issuer"],
            lambda: cred_reg.functions.credentials(cid).call()[5] == 0)
        return b, r, True

    def scn_s3():  # register agent under victim's owner DID (attacker holds a valid agent key)
        k = Account.create()
        fn, agent = register_agent_fn(agent_reg, owner_did, k.address, k.key, model_hash=w3.keccak(text="evil"))
        b, r = attack(fn, ATTACKER, REASONS["not_owner_did"],
                      lambda: agent_reg.functions.agents(agent).call()[4] is False)
        # positive control: the real owner can register under the same DID
        k2 = Account.create()
        fn2, _ = register_agent_fn(agent_reg, owner_did, k2.address, k2.key)
        ctrl = send(fn2, OWNER).status == 1
        return b, r, ctrl

    def scn_s3b():  # duplicate agent DID re-registration (even by the owner)
        k = Account.create()
        fn, agent = register_agent_fn(agent_reg, owner_did, k.address, k.key, model_hash=w3.keccak(text="orig"))
        must(fn, OWNER)
        orig = agent_reg.functions.agents(agent).call()[2]
        k2 = Account.create()
        fn2, _ = register_agent_fn(agent_reg, owner_did, k2.address, k2.key,
                                   agent_did=agent, model_hash=w3.keccak(text="overwrite"))
        b, r = attack(fn2, OWNER, REASONS["agent_exists"],
                      lambda: agent_reg.functions.agents(agent).call()[2] == orig)
        return b, r, True

    def scn_s4():  # revoked credential is rejected (registry level)
        cid = new_cred()
        before = tuple(cred_reg.functions.verifyCredential(cid).call())
        must(cred_reg.functions.revokeCredential(cid), OWNER)       # receipt awaited
        after = tuple(cred_reg.functions.verifyCredential(cid).call())
        return after == (False, "Revoked"), f"status={after[1]}", before == (True, "Valid")

    def scn_s5():  # un-revoke by re-issuing the same credID, even by the issuer
        cid = new_cred()
        must(cred_reg.functions.revokeCredential(cid), OWNER)
        b, r = attack(
            cred_reg.functions.issueCredential(cid, owner_did, w3.keccak(text="h"), w3.keccak(text="c"), w3.keccak(text="x"), 31536000),
            OWNER, REASONS["cred_exists"],
            lambda: tuple(cred_reg.functions.verifyCredential(cid).call()) == (False, "Revoked"))
        return b, r, True

    def scn_s6():  # trade after delegation revoked
        must(deleg_reg.functions.setPermission(A_REVOKE, w3.to_wei(1, "ether"), 3600), OWNER)
        ctrl = send(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_REVOKE, gas=200000).status == 1
        must(deleg_reg.functions.revokePermission(A_REVOKE), OWNER)
        bal = wallet_bal()
        b, r = attack(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_REVOKE,
                      REASONS["access_denied"], lambda: wallet_bal() == bal)
        return b, r, ctrl

    def scn_s7():  # trade above limit
        must(deleg_reg.functions.setPermission(A_LIMIT, w3.to_wei(0.5, "ether"), 3600), OWNER)
        ctrl = send(wallet.functions.executeTrade(DEAD, w3.to_wei(0.1, "ether")), A_LIMIT, gas=200000).status == 1
        bal = wallet_bal()
        b, r = attack(wallet.functions.executeTrade(DEAD, w3.to_wei(1.5, "ether")), A_LIMIT,
                      REASONS["access_denied"], lambda: wallet_bal() == bal)
        return b, r, ctrl

    def scn_s8():  # non-owner revokes someone else's delegation
        must(deleg_reg.functions.setPermission(A_NONOWNER, w3.to_wei(1, "ether"), 3600), OWNER)
        b, r = attack(deleg_reg.functions.revokePermission(A_NONOWNER), ATTACKER,
                      REASONS["no_delegation"],
                      lambda: deleg_reg.functions.permissions(OWNER, A_NONOWNER).call()[0] is True)
        return b, r, True

    def scn_s9():  # trade after delegation expired (uses evm time travel)
        must(deleg_reg.functions.setPermission(A_EXPIRE, w3.to_wei(1, "ether"), 60), OWNER)
        ctrl = send(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_EXPIRE, gas=200000).status == 1
        expiry = deleg_reg.functions.permissions(OWNER, A_EXPIRE).call()[2]
        now = w3.eth.get_block("latest")["timestamp"]
        w3.provider.make_request("evm_setNextBlockTimestamp", [max(expiry, now) + 1])
        w3.provider.make_request("evm_mine", [])
        latest = w3.eth.get_block("latest")["timestamp"]
        if latest <= expiry:
            raise RuntimeError(f"time travel failed: latest={latest} expiry={expiry}")
        bal = wallet_bal()
        b, r = attack(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_EXPIRE,
                      REASONS["access_denied"], lambda: wallet_bal() == bal)
        return b, r, ctrl

    def scn_s10():  # agent with a valid delegation but NO registered identity
        k = Account.create()
        fund(k.address)
        must(deleg_reg.functions.setPermission(k.address, w3.to_wei(1, "ether"), 3600), OWNER)
        bal = wallet_bal()
        b, r = attack(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), k,
                      REASONS["not_registered"], lambda: wallet_bal() == bal)
        # control: a registered + delegated agent trades
        ctrl = send(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_CONTROL, gas=200000).status == 1
        return b, r, ctrl

    def scn_s11():  # owner binds an agent key WITHOUT that key's signature (forged consent)
        victim, other = Account.create(), Account.create()
        fn, _ = register_agent_fn(agent_reg, owner_did, victim.address, victim.key,
                                  sig_by=(other.address, other.key))
        b, r = attack(fn, OWNER, REASONS["bad_agent_sig"],
                      lambda: bytes(agent_reg.functions.agentDIDByAddress(victim.address).call()) == bytes(32))
        fn2, _ = register_agent_fn(agent_reg, owner_did, victim.address, victim.key)
        ctrl = send(fn2, OWNER).status == 1
        return b, r, ctrl

    def scn_s12():  # deactivated agent identity cannot trade, even with a live delegation
        k = Account.create()
        fund(k.address)
        fn, agent = register_agent_fn(agent_reg, owner_did, k.address, k.key)
        must(fn, OWNER)
        must(deleg_reg.functions.setPermission(k.address, w3.to_wei(1, "ether"), 3600), OWNER)
        ctrl = send(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), k, gas=200000).status == 1
        must(agent_reg.functions.deactivateAgent(agent), OWNER)
        bal = wallet_bal()
        b, r = attack(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), k,
                      REASONS["not_registered"], lambda: wallet_bal() == bal)
        return b, r, ctrl

    scenarios = [
        ("S1  Non-issuer revokes credential", scn_s1),
        ("S2  Non-issuer issues credential", scn_s2),
        ("S3  Register agent under victim's owner DID", scn_s3),
        ("S3b Re-register existing agent DID (overwrite)", scn_s3b),
        ("S4  Revoked credential reports Revoked", scn_s4),
        ("S5  Re-issue same credID to un-revoke", scn_s5),
        ("S6  Trade after delegation revoked", scn_s6),
        ("S7  Trade above delegated limit", scn_s7),
        ("S8  Non-owner revokes another's delegation", scn_s8),
        ("S9  Trade after delegation expired", scn_s9),
        ("S10 Delegated but unregistered agent trades", scn_s10),
        ("S11 Bind agent key without its signature", scn_s11),
        ("S12 Trade after agent identity deactivated", scn_s12),
    ]

    table = []
    for name, fn in scenarios:
        ok_n, ctrl_n, first_reason = 0, 0, ""
        for i in range(repeats):
            try:
                blocked, reason, ctrl = fn()
            except Exception as e:
                blocked, reason, ctrl = False, f"RIG ERROR: {e}", False
            ok_n += int(blocked)
            ctrl_n += int(ctrl)
            if i == 0:
                first_reason = reason
        short = first_reason.replace("execution reverted: ", "").replace("\n", " ")[:46]
        verdict = "PASS" if ok_n == repeats and ctrl_n == repeats else "FAIL"
        print(f"  {verdict}  {name:50s} blocked {ok_n}/{repeats} | control {ctrl_n}/{repeats} | {short}")
        table.append({"scenario": name, "blocked": ok_n, "repeats": repeats, "control_ok": ctrl_n,
                      "observed_reason": first_reason, "verdict": verdict})

    print("\n  Note: S4 is a registry-level check. The full end-to-end check (BC Wallet presentation")
    print("  rejected after revocation) is a manual demo against the live stack.")
    print("  Repeats confirm determinism, they are not independent statistical trials.\n")
    RESULTS["security"] = table


# ==============================================================================
# EXPERIMENT 3: LATENCY BREAKDOWN (warm-up discarded)
# ==============================================================================
async def latency_breakdown(did_reg, agent_reg, cred_reg, deleg_reg, wallet, n, warmup):
    print("=" * 78)
    print(f"LATENCY BREAKDOWN (service level; N={n} after {warmup} discarded warm-up runs)")
    print("=" * 78)
    ops = ["P1_registerDID", "P2_registerAgent", "P3_issueCred", "P5_revokeCred", "P6_setPermission", "P6_executeTrade"]
    st = {o: {"acapy": [], "ipfs": [], "chain": [], "total": [], "gas": []} for o in ops}

    def log(op, aca, ipfs, chain, total, gas, keep):
        if keep:
            for k, v in (("acapy", aca), ("ipfs", ipfs), ("chain", chain), ("total", total), ("gas", gas)):
                st[op][k].append(v)

    must(deleg_reg.functions.setPermission(A_CONTROL, w3.to_wei(50, "ether"), 360000), OWNER)

    async with httpx.AsyncClient(timeout=30) as c:
        for i in range(n + warmup):
            keep = i >= warmup

            # P1: ACA-Py DID + IPFS DID doc + registerDID
            t_all = time.perf_counter()
            t0 = time.perf_counter()
            r = await c.post(f"{ACAPY_ISSUER_URL}/wallet/did/create", json={"method": "sov", "options": {"key_type": "ed25519"}})
            human_did, verkey = r.json()["result"]["did"], r.json()["result"]["verkey"]
            t_aca = (time.perf_counter() - t0) * 1000
            t0 = time.perf_counter()
            r = await c.post(IPFS_API_URL, files={"file": json.dumps({"id": f"did:sov:{human_did}", "key": verkey})})
            cid = r.json()["Hash"]
            t_ipfs = (time.perf_counter() - t0) * 1000
            t0 = time.perf_counter()
            did_h = w3.keccak(text=human_did)
            rec = must(did_reg.functions.registerDID(did_h, w3.keccak(text=cid), w3.keccak(text=f"GOV-{uuid.uuid4().hex}")), OWNER)
            t_chain = (time.perf_counter() - t0) * 1000
            log("P1_registerDID", t_aca, t_ipfs, t_chain, (time.perf_counter() - t_all) * 1000, rec.gasUsed, keep)

            # P2: ACA-Py DID + IPFS agent doc + registerAgent (owner DID registered above)
            t_all = time.perf_counter()
            t0 = time.perf_counter()
            r = await c.post(f"{ACAPY_VERIFIER_URL}/wallet/did/create", json={"method": "sov", "options": {"key_type": "ed25519"}})
            agent_did = r.json()["result"]["did"]
            t_aca = (time.perf_counter() - t0) * 1000
            t0 = time.perf_counter()
            r = await c.post(IPFS_API_URL, files={"file": json.dumps({"agentDID": agent_did, "ownerDID": human_did})})
            acid = r.json()["Hash"]
            t_ipfs = (time.perf_counter() - t0) * 1000
            t0 = time.perf_counter()
            adid_h = w3.keccak(text=agent_did)
            ak = Account.create()
            fn, _ = register_agent_fn(agent_reg, did_h, ak.address, ak.key, agent_did=adid_h,
                                      model_hash=w3.keccak(text=f"Llama-3-8B|1.0|{acid}"))
            rec = must(fn, OWNER)
            t_chain = (time.perf_counter() - t0) * 1000
            log("P2_registerAgent", t_aca, t_ipfs, t_chain, (time.perf_counter() - t_all) * 1000, rec.gasUsed, keep)

            # P3: IPFS credential + issueCredential (wallet delivery NOT included)
            t_all = time.perf_counter()
            t0 = time.perf_counter()
            vc = {"id": f"urn:uuid:{uuid.uuid4()}", "issuer": human_did, "subject": agent_did}
            r = await c.post(IPFS_API_URL, files={"file": json.dumps(vc)})
            vc_cid = r.json()["Hash"]
            t_ipfs = (time.perf_counter() - t0) * 1000
            t0 = time.perf_counter()
            cred_id = w3.keccak(text=f"cred_LIC-{uuid.uuid4().hex[:12]}")
            rec = must(cred_reg.functions.issueCredential(
                cred_id, did_h, adid_h, w3.keccak(text=vc_cid), w3.keccak(text=json.dumps(vc)), 31536000), OWNER)
            t_chain = (time.perf_counter() - t0) * 1000
            log("P3_issueCred", 0.0, t_ipfs, t_chain, (time.perf_counter() - t_all) * 1000, rec.gasUsed, keep)

            # P5: revokeCredential (chain only, matches the backend)
            t_all = time.perf_counter()
            rec = must(cred_reg.functions.revokeCredential(cred_id), OWNER)
            t_chain = (time.perf_counter() - t_all) * 1000
            log("P5_revokeCred", 0.0, 0.0, t_chain, t_chain, rec.gasUsed, keep)

            # P6: setPermission on a fresh agent address (first-use cost)
            t_all = time.perf_counter()
            rec = must(deleg_reg.functions.setPermission(w3.eth.account.create().address, w3.to_wei(2, "ether"), 3600), OWNER)
            t_chain = (time.perf_counter() - t_all) * 1000
            log("P6_setPermission", 0.0, 0.0, t_chain, t_chain, rec.gasUsed, keep)

            # P6: executeTrade via AgentWallet (steady state)
            t_all = time.perf_counter()
            rec = must(wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")), A_CONTROL, gas=200000)
            t_chain = (time.perf_counter() - t_all) * 1000
            log("P6_executeTrade", 0.0, 0.0, t_chain, t_chain, rec.gasUsed, keep)

    hdr = f"  {'Operation':18s} | {'Gas':>8s} | {'ACA-Py':>8s} | {'IPFS':>8s} | {'Chain':>8s} | {'Total mean':>10s} | {'median':>8s} | {'SD':>7s} | {'p95':>8s}"
    print(hdr)
    print("  " + "-" * (len(hdr) - 2))
    out = {}
    for op in ops:
        d = st[op]
        tot = summarize(d["total"])
        print(f"  {op:18s} | {int(statistics.mean(d['gas'])):8,d} | {statistics.mean(d['acapy']):8.1f} | "
              f"{statistics.mean(d['ipfs']):8.1f} | {statistics.mean(d['chain']):8.1f} | "
              f"{tot['mean']:10.1f} | {tot['median']:8.1f} | {tot['sd']:7.1f} | {tot['p95']:8.1f}")
        out[op] = {"gas_mean": statistics.mean(d["gas"]), "acapy_ms": statistics.mean(d["acapy"]),
                   "ipfs_ms": statistics.mean(d["ipfs"]), "chain_ms": statistics.mean(d["chain"]), "total_ms": tot}
    print("\n  All times in ms. Scope: contract + ACA-Py + IPFS calls made directly by this rig,")
    print("  not the FastAPI path. P3 excludes BC Wallet delivery. Chain time depends on the")
    print("  Anvil mining mode shown in the environment block.\n")
    RESULTS["latency"] = out


# ==============================================================================
# EXPERIMENT 4a: DIRECT SCALING (independent EOAs, repeated runs)
# ==============================================================================
async def direct_scaling(deleg_reg, wallet, agent_reg, repeats):
    print("=" * 78)
    print(f"DIRECT SCALING (rig -> chain, independent signers, {repeats} runs per N)")
    print("=" * 78)
    sizes = [5, 10, 25, 50]
    print("  [setup] provisioning 50 agent EOAs...")
    signers = [w3.eth.account.create() for _ in range(50)]
    for a in signers:
        w3.eth.wait_for_transaction_receipt(
            w3.eth.send_transaction({"from": OWNER, "to": a.address, "value": w3.to_wei(0.5, "ether")}))
        must(deleg_reg.functions.setPermission(a.address, w3.to_wei(5, "ether"), 360000), OWNER)
        fn, _ = register_agent_fn(agent_reg, RIG["owner_did"], a.address, a.key)
        must(fn, OWNER)

    def trade(acct):
        t0 = time.perf_counter()
        nonce = w3.eth.get_transaction_count(acct.address, "pending")
        tx = wallet.functions.executeTrade(DEAD, w3.to_wei(0.01, "ether")).build_transaction({
            "from": acct.address, "nonce": nonce, "gas": 150000, "gasPrice": w3.to_wei("1", "gwei")})
        signed = w3.eth.account.sign_transaction(tx, acct.key)
        raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
        h = w3.eth.send_raw_transaction(raw)
        rec = w3.eth.wait_for_transaction_receipt(h)
        return (time.perf_counter() - t0) * 1000, rec.status == 1

    # untimed warm-up (thread pool, HTTP connections)
    await asyncio.gather(*(asyncio.to_thread(trade, a) for a in signers[:5]))

    out = {}
    for n in sizes:
        tps_runs, lats, fails = [], [], 0
        for _ in range(repeats):
            t0 = time.perf_counter()
            res = await asyncio.gather(*(asyncio.to_thread(trade, a) for a in signers[:n]))
            el = time.perf_counter() - t0
            good = [r for r in res if r[1]]
            fails += n - len(good)
            tps_runs.append(len(good) / el)
            lats += [r[0] for r in good]
        t = summarize(tps_runs)
        l = summarize(lats)
        print(f"  N={n:2d} | TPS {t['mean']:6.1f} +- {t['sd']:5.1f} (over {repeats} runs) | "
              f"latency median {l['median']:6.1f} ms, p95 {l['p95']:6.1f} ms | failures {fails}")
        out[n] = {"tps": t, "latency_ms": l, "failures": fails}
    print("\n  This is client + node processing rate on a zero/low block-time dev chain,")
    print("  not blockchain TPS.\n")
    RESULTS["scaling_direct"] = out


# ==============================================================================
# EXPERIMENT 4b: API-PATH SCALING (through the live FastAPI verifier)
# ==============================================================================
async def api_scaling(owner_did, repeats):
    print("=" * 78)
    print(f"API-PATH SCALING (through FastAPI /protocol6/execute-trade, {repeats} runs per N)")
    print("=" * 78)
    sizes = [5, 10, 25, 50]
    async with httpx.AsyncClient(timeout=60) as c:
        try:
            assert (await c.get(f"{VERIFIER_API_URL}/")).status_code == 200
        except Exception:
            print("  Verifier API not reachable, skipping.\n")
            return
        agents = []
        print("  [setup] registering + funding + delegating 50 agents through the API (sequential)...")
        for i in range(50):
            r = await c.post(f"{VERIFIER_API_URL}/protocol2/register-abcd", json={
                "owner_did": owner_did, "model_architecture": f"Agent-{i}", "version_tag": "v1.0",
                "training_hash": w3.keccak(text=f"h_{i}_{time.time()}").hex()})
            if r.status_code != 200:
                print(f"  register-abcd failed ({r.status_code}): {r.text[:200]}")
                print("  (owner DID must be registered in the DIDRegistry the backend uses)\n")
                return
            d = r.json()["abcd_layers"]["C"]
            w3.eth.wait_for_transaction_receipt(w3.eth.send_transaction(
                {"from": OWNER, "to": Web3.to_checksum_address(d["wallet_address"]), "value": w3.to_wei(0.5, "ether")}))
            rd = await c.post(f"{VERIFIER_API_URL}/protocol6/delegate", json={
                "owner_address": OWNER, "agent_did": d["did"], "spend_limit_eth": 10.0, "duration_seconds": 36000})
            assert rd.status_code == 200, rd.text[:200]
            agents.append(d["did"])

        async def trade(did):
            t0 = time.perf_counter()
            r = await c.post(f"{VERIFIER_API_URL}/protocol6/execute-trade", json={"agent_did": did, "amount_eth": 0.01})
            ok = r.status_code == 200 and r.json().get("status") == "success"
            return (time.perf_counter() - t0) * 1000, ok

        await asyncio.gather(*(trade(a) for a in agents[:5]))  # warm-up
        out = {}
        for n in sizes:
            tps_runs, lats, fails = [], [], 0
            for _ in range(repeats):
                t0 = time.perf_counter()
                res = await asyncio.gather(*(trade(a) for a in agents[:n]))
                el = time.perf_counter() - t0
                good = [r for r in res if r[1]]
                fails += n - len(good)
                tps_runs.append(len(good) / el)
                lats += [r[0] for r in good]
            t, l = summarize(tps_runs), summarize(lats)
            print(f"  N={n:2d} | TPS {t['mean']:6.1f} +- {t['sd']:5.1f} | latency median {l['median']:7.1f} ms, "
                  f"p95 {l['p95']:7.1f} ms | failures {fails}")
            out[n] = {"tps": t, "latency_ms": l, "failures": fails}
        print("\n  Compare against the pre-fix baseline (flat ~8.4 TPS, linear latency growth).\n")
        RESULTS["scaling_api"] = out


# ==============================================================================
async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=30, help="latency samples after warm-up")
    ap.add_argument("--warmup", type=int, default=5)
    ap.add_argument("--repeats", type=int, default=5, help="repeats for scaling runs and security scenarios")
    ap.add_argument("--label", default="automine", help="free text describing Anvil mining mode, e.g. 'block-time=2s'")
    ap.add_argument("--skip-latency", action="store_true")
    ap.add_argument("--api", action="store_true", help="also run API-path scaling against the live verifier")
    ap.add_argument("--owner-did", default="8jMaEBx4cqXoXtJUW5PVnc")
    args = ap.parse_args()

    await environment_report(args.label)
    did_reg, agent_reg, cred_reg, deleg_reg, wallet = deploy_all()
    gas_profile(did_reg, agent_reg, cred_reg, deleg_reg, wallet)
    security_scenarios(did_reg, agent_reg, cred_reg, deleg_reg, wallet, args.repeats)
    if not args.skip_latency:
        await latency_breakdown(did_reg, agent_reg, cred_reg, deleg_reg, wallet, args.n, args.warmup)
    await direct_scaling(deleg_reg, wallet, agent_reg, args.repeats)
    if args.api:
        await api_scaling(args.owner_did, args.repeats)

    with open("icbc_results.json", "w") as f:
        json.dump(RESULTS, f, indent=2, default=str)
    print("Results saved to icbc_results.json")


if __name__ == "__main__":
    asyncio.run(main())