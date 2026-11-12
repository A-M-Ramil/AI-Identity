from datetime import datetime
import json
import httpx
from web3 import Web3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import base64
import uuid
import os

# --- CONFIGURATION ---
# 1. Blockchain (Anvil)
ANVIL_RPC_URL = "http://127.0.0.1:8545"
# UPDATE THIS ADDRESS AFTER DEPLOYING CONTRACTS!
DID_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" 
# Account #0 Private Key (Admin/Deployer) - Pays for the registration gas
ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" 
AGENT_STORAGE_FILE = "agent_keys.json"
# 2. ACA-Py (The Identity Wallet)
# CRITICAL: This must be the ADMIN API port. Standard is 8021. 
# If your docker only exposes 8000, check if that is Admin or Inbound.
ACAPY_ADMIN_URL = "http://127.0.0.1:8030" 
IPFS_API_URL = "http://127.0.0.1:5001/api/v0/add"
CREDENTIAL_REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" # <--- UPDATE THIS AFTER DEPLOY
USER_WALLET_MAP = {}

AGENT_REGISTRY_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" 
DELEGATION_REGISTRY_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"

class DelegateRequest(BaseModel):
    owner_address: str # Human's Address (Account 0 in Anvil)
    agent_address: str # Agent's Address
    spend_limit_eth: float
    duration_seconds: int

class TradeRequest(BaseModel):
    wallet_address: str
    agent_private_key: str # To sign as Agent
    amount_eth: float
class RegisterAgentRequest(BaseModel):
    owner_did: str
    agent_role: str # We will map this to a fake Model Hash for demo

class VerifyAgentRequest(BaseModel):
    owner_did: str
    agent_did: str

class PresentationRequest(BaseModel):
    holder_did: str
    verkey: str
    credential_id: str
    ipfs_cid: str
    challenge: str

class VerifyRequest(BaseModel):
    presentation_json: dict
    challenge: str
    verkey: str
    
class RevokeRequest(BaseModel):
    holder_did: str
    claim_type: str
    
    
class AuditRequest(BaseModel):
    target_did: str

class IssueCredentialRequest(BaseModel):
    holder_did: str
    claim_type: str  # e.g., "TradingLicense"
    claim_data: dict

class RegisterRequest(BaseModel):
    gov_id: str

class IssueCredentialRequest(BaseModel):
    issuer_did: str          
    subject_did: str         
    credential_data: dict    

class VerifyPresentationRequest(BaseModel):
    presentation_json: dict

app = FastAPI()

# Enable CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))

CRED_CONFIG = {
    "DeFiTradingLicense": {
        "schema_id": "BEjT63Lpv7ZuMbrmbUNwqx:2:defi_trading_license:1.1094",
        "cred_def_id": "BEjT63Lpv7ZuMbrmbUNwqx:3:CL:3323395:tag_1094"
    },
    "PersonalAssistantID": {
        "schema_id": "BEjT63Lpv7ZuMbrmbUNwqx:2:personal_assistant_id:1.1108",
        "cred_def_id": "BEjT63Lpv7ZuMbrmbUNwqx:3:CL:3323397:tag_1108"
    },
    "MedicalProxyAuth": {
        "schema_id": "BEjT63Lpv7ZuMbrmbUNwqx:2:medical_proxy_auth:1.1121",
        "cred_def_id": "BEjT63Lpv7ZuMbrmbUNwqx:3:CL:3323399:tag_1121"
    }
}
def send_tx(tx):
    signed = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
    raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise HTTPException(status_code=409,
            detail=f"Reverted on-chain: {w3.to_hex(tx_hash)}")
    return tx_hash, receipt


def load_contract_data(filename):
    with open(filename, "r") as f:
        data = json.load(f)
        
        # 1. Extract ABI
        abi = data["abi"]
        
        # 2. Extract Bytecode (Robust Handling)
        bytecode = data.get("bytecode")
        
        # FIX: Foundry/Hardhat often nest the bytecode string inside an "object" field
        if isinstance(bytecode, dict) and "object" in bytecode:
            bytecode = bytecode["object"]
            
        return abi, bytecode

def save_agent_key(did, private_key, address, model_data):
    """Saves Agent secrets to a local JSON file (Simulating a Secure Enclave)"""
    if os.path.exists(AGENT_STORAGE_FILE):
        with open(AGENT_STORAGE_FILE, "r") as f:
            db = json.load(f)
    else:
        db = {}
    
    db[did] = {
        "private_key": private_key,
        "address": address,
        "layer_a": model_data # Algorithmic Fingerprint
    }
    
    with open(AGENT_STORAGE_FILE, "w") as f:
        json.dump(db, f, indent=2)

def get_agent_key(identifier):
    """
    Omni-Search: Looks up the agent's secure enclave data.
    Allows the frontend to pass either the exact DID or the Agent's Ethereum Address.
    """
    if not os.path.exists(AGENT_STORAGE_FILE): 
        return None
        
    with open(AGENT_STORAGE_FILE, "r") as f:
        db = json.load(f)
        
    # 1. Try a direct match (If the user pasted the exact DID key)
    if identifier in db:
        return db[identifier]
        
    # 2. Try an Ethereum Address match (If the user pasted the 0x... address)
    identifier_lower = identifier.strip().lower()
    for did, data in db.items():
        # Check if the saved address matches the pasted input
        saved_address = data.get("address", "").lower()
        
        # Also check if it matches the "layer_a" DID just in case of custom UI formats
        layer_a_did = data.get("layer_a", {}).get("did", "").lower()
        
        if identifier_lower == saved_address or identifier_lower == layer_a_did:
            return data
            
    # If we get here, neither the DID nor the ETH address matched anything in the JSON
    return None

# --- UPDATED REQUEST MODELS ---
class RegisterABCDRequest(BaseModel):
    owner_did: str
    # Layer A: Algorithmic Fingerprint
    model_architecture: str  # e.g. "Transformer-6B"
    version_tag: str         # e.g. "v2.1.5"
    training_hash: str       # e.g. "sha256:9f86d0..."

class FundAgentRequest(BaseModel):
    agent_did: str
    amount_eth: float


class RegisterRequest(BaseModel):
    gov_id: str
    name: str

class LinkWalletRequest(BaseModel):
    connection_id: str
    wallet_address: str
    did: str
IDENTITY_DB = {}







# Load Contract ABI
try:
    with open("DIDRegistry.json", "r") as f:
        did_abi = json.load(f)["abi"]
    did_contract = w3.eth.contract(address=DID_REGISTRY_ADDRESS, abi=did_abi)
    print("✅ Blockchain Connected")
except Exception as e:
    print(f"❌ Contract Loading Error: {e}")
    
    
    
# Load AgentRegistry ABI
try:
    with open("AgentRegistry.json", "r") as f:
        AGENT_REGISTRY_ABI = json.load(f)["abi"]
    agent_contract = w3.eth.contract(address=AGENT_REGISTRY_ADDRESS, abi=AGENT_REGISTRY_ABI)
    print("✅ AgentRegistry Contract Loaded")
except Exception as e:
    print(f"⚠️ AgentRegistry Load Error: {e}")
    
    
    
try:
    with open("DelegationRegistry.json", "r") as f:
        DELEGATION_ABI = json.load(f)["abi"]
    print("✅ Delegation ABI Loaded")
except Exception as e:
    print(f"⚠️ Delegation ABI Load Error: {e}")
    
    
try:
    WALLET_ABI, WALLET_BYTECODE = load_contract_data("AgentWallet.json")
    print("✅ AgentWallet ABI Loaded")
except Exception as e:
    print(f"⚠️ Contract Load Error: {e}")
    # Fallback to prevent crash if files missing during dev
    WALLET_ABI = []
    WALLET_BYTECODE = "0x"
    
try:
    with open("CredentialRegistry.json", "r") as f:
        cred_abi = json.load(f)["abi"]
    cred_contract = w3.eth.contract(address=CREDENTIAL_REGISTRY_ADDRESS, abi=cred_abi)
    print("✅ CredentialRegistry Contract Loaded")
except Exception as e:
    print(f"⚠️ CredentialRegistry Load Error: {e}")
    cred_contract = None
 
class DelegateRequest(BaseModel):
    owner_address: str
    agent_did: str 
    spend_limit_eth: float
    duration_seconds: int

class TradeRequest(BaseModel):
    agent_did: str 
    amount_eth: float



@app.get("/")
def health_check():
    return {"status": "active", "protocol": "1", "mode": "ACA-Py Bridge"}




@app.post("/protocol2/register-abcd")
async def register_agent_abcd(req: RegisterABCDRequest):
    print(f"\n--- 🤖 PROTOCOL 2: AGENT REGISTRATION (ABCD) ---")
    try:
        # A. IDENTITY GENERATION (Layer C)
        # 1. Generate Real ETH Wallet (For Protocol 6)
        acct = w3.eth.account.create()
        agent_address = acct.address
        agent_private_key = acct.key.hex()
        print(f"🔹 Layer C (Wallet): {agent_address}")
        
        # 2. Generate DID String
        agent_did_string = f"did:sov:agent:{uuid.uuid4().hex[:8]}"
        
        print(f"🔹 Layer C (Wallet): {agent_address}")
        print(f"🔹 Layer C (DID):    {agent_did_string}")

        
        async with httpx.AsyncClient() as client:
            did_res = await client.post(
                f"{ACAPY_ADMIN_URL}/wallet/did/create",
                json={"method": "sov", "options": {"key_type": "ed25519"}}
            )
            if did_res.status_code != 200:
                raise HTTPException(status_code=500, detail="ACA-Py DID Creation Failed")
            
            did_data = did_res.json()
            agent_did_string = did_data["result"]["did"]
            verkey = did_data["result"]["verkey"]
            
        print(f"🔹 Layer C (DID):    {agent_did_string}")
        print(f"🔹 Layer C (Verkey): {verkey}")
        
        # B. HASHING (Layer A)
        model_string = f"{req.model_architecture}|{req.version_tag}|{req.training_hash}"
        
        # Solidity bytes32 conversion
        agent_hash = w3.keccak(text=agent_did_string)
        owner_hash = w3.keccak(text=req.owner_did)
        model_hash = w3.keccak(text=model_string)

        print(f"🔹 Layer A (Hash):   {w3.to_hex(model_hash)}")
        # C. BLOCKCHAIN ANCHORING (The "Registry")
        # We use the existing Smart Contract logic you provided
        contract = w3.eth.contract(address=AGENT_REGISTRY_ADDRESS, abi=AGENT_REGISTRY_ABI)

        tx = contract.functions.registerAgent(
            agent_hash,
            owner_hash,
            model_hash
        ).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        # signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)  
        # raw_tx = None
        # if hasattr(signed_tx, "rawTransaction"):
        #     raw_tx = signed_tx.rawTransaction
        # elif hasattr(signed_tx, "raw_transaction"):
        #     raw_tx = signed_tx.raw_transaction
        # elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
        #     raw_tx = signed_tx["rawTransaction"]
        # else:
        #     # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
        #     try:
        #         raw_tx = signed_tx[0]
        #     except:
        #         pass

        # if raw_tx is None:
        #     raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")
        tx_hash, receipt = send_tx(tx)
        # Send to Blockchain
        # tx_hash = w3.eth.send_raw_transaction(raw_tx)
        # receipt = w3.eth.wait_for_transaction_receipt(tx_hash)


        
        print(f"✅ Agent Anchored! TX: {w3.to_hex(tx_hash)}")

        # D. PERSISTENCE (Save Keys for Protocol 6)
        save_agent_key(agent_did_string, agent_private_key, agent_address, {
            "arch": req.model_architecture,
            "ver": req.version_tag
        })

        return {
            "status": "success",
            "abcd_layers": {
                "C": {"did": agent_did_string, "wallet_address": agent_address},
                "A": {"fingerprint": model_string}
            },
            "tx_hash": w3.to_hex(tx_hash)
        }

    except Exception as e:
        print(f"❌ REGISTRATION FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 2. VERIFICATION (READ) ---
@app.post("/protocol2/verify-link")
async def verify_link(req: VerifyAgentRequest):
    """
    Uses the Smart Contract's 'verifyOwnership' function to prove the link.
    """
    try:
        contract = w3.eth.contract(address=AGENT_REGISTRY_ADDRESS, abi=AGENT_REGISTRY_ABI)
        
        agent_hash = w3.keccak(text=req.agent_did)
        owner_hash = w3.keccak(text=req.owner_did)
        
        # Call verifyOwnership(humanDID, agentDID) -> bool
        is_owner = contract.functions.verifyOwnership(owner_hash, agent_hash).call()
        
        # Also fetch profile to get status
        profile = contract.functions.agents(agent_hash).call()
        is_active = profile[4] # Index 4 is 'bool active'
        
        return {
            "status": "success",
            "is_linked": is_owner,
            "is_active": is_active,
            "on_chain_owner_hash": w3.to_hex(profile[1])
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}

# --- 3. FLEET MANAGEMENT (READ) ---
@app.get("/protocol2/fetch-fleet/{owner_did}")
async def fetch_fleet(owner_did: str):
    """
    Recovers the entire history of Agents owned by this DID from the Blockchain.
    """
    try:
        contract = w3.eth.contract(address=AGENT_REGISTRY_ADDRESS, abi=AGENT_REGISTRY_ABI)
        owner_hash = w3.keccak(text=owner_did)
        
        found_agents = []
        
        # Forensic Iteration: Check index 0, 1, 2... until we hit a revert or empty
        for i in range(20): # Check first 20 agents
            try:
                # 1. Get the Agent Hash at index i
                agent_hash_bytes = contract.functions.ownerToAgents(owner_hash, i).call()
                agent_hash_hex = w3.to_hex(agent_hash_bytes)
                
                # 2. Get the Profile Details
                profile = contract.functions.agents(agent_hash_bytes).call()
                # profile: (agentDID, ownerDID, modelHash, registeredAt, active)
                
                found_agents.append({
                    "agent_hash": agent_hash_hex,
                    "is_active": profile[4],
                    "role_hash": w3.to_hex(profile[2]),
                    "index": i
                })
            except:
                # End of list
                break
                
        return {"status": "success", "agents": found_agents}

    except Exception as e:
        return {"status": "error", "reason": str(e)}

# --- 4. FUNDING (From Protocol 6 Setup) ---
@app.post("/protocol2/fund-agent")
async def fund_agent(req: FundAgentRequest):
    try:
        # Retrieve Agent Address from Enclave
        agent_data = get_agent_key(req.agent_did)
        if not agent_data: raise HTTPException(status_code=404, detail="Agent not found")
        
        target_address = agent_data["address"]
        print(f"\n--- 💸 FUNDING AGENT: {target_address} ---")

        # In a real app, Frontend signs this. 
        # For demo speed, Admin (Account 0) funds it if using this endpoint.
        tx = {
            'to': target_address,
            'value': w3.to_wei(req.amount_eth, 'ether'),
            'gas': 21000,
            'gasPrice': w3.to_wei('1', 'gwei'),
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
        }
        signed = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"status": "success", "new_balance": float(w3.from_wei(w3.eth.get_balance(target_address), 'ether'))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/protocol2/get-balance/{agent_did}")
async def get_agent_balance(agent_did: str):
    agent_data = get_agent_key(agent_did)
    if not agent_data: return {"balance": 0}
    return {"balance": float(w3.from_wei(w3.eth.get_balance(agent_data["address"]), 'ether'))}

#---------------------------------------------------------





@app.post("/protocol4/connect-verifier")
async def connect_verifier():
    """
    Step 0: The user must establish a connection with the DeFi platform
    before the platform can ask them for a ZK-Proof.
    """
    print("📡 Generating Verifier Connection Invitation...")
    async with httpx.AsyncClient() as client:
        try:
            body = {
                "alias": "DeFi User",
                "my_label": "Web3 DeFi Platform" # The phone will see this name!
            }
            response = await client.post(
                f"{ACAPY_ADMIN_URL}/connections/create-invitation", 
                json=body
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Agent Error: {response.text}")
                
            data = response.json()
            conn_id = data["connection_id"]
            print(f"\n✅ VERIFIER CONNECTION ID: {conn_id}\n")
            
            return {
                "status": "invitation_created",
                "connection_id": conn_id,
                "invitation_url": data["invitation_url"],
                "message": "Scan this with BC Wallet to 'Log In' to DeFi"
            }
        except Exception as e:
            print(f"❌ Connection Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.get("/protocol4/check-connection/{connection_id}")
async def check_verifier_connection(connection_id: str):
    """Allows the DeFi UI to auto-detect when the user scans the QR code."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{ACAPY_ADMIN_URL}/connections/{connection_id}")
            state = response.json().get("state", "init")
            is_connected = state in ["active", "response"]
            return {"state": state, "connected": is_connected}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/protocol4/request-proof")
async def request_proof(req: VerifyRequest):
    print(f"\n--- 🕵️ PROTOCOL 4: REQUESTING PROOF ---")
    
    connection_id = req.verkey 
    claim_type = req.challenge # e.g. "Personal Assistant ID"

    # 1. Normalize Type
    clean_type = claim_type.replace(" ", "")
    config = CRED_CONFIG.get(clean_type)
    
    if not config:
        print(f"❌ Error: Unknown License Type '{clean_type}'. Defaulting to DeFi.")
        config = CRED_CONFIG.get("DeFiTradingLicense")
        clean_type = "DeFiTradingLicense"

    print(f"🔹 Asking Connection {connection_id} for '{clean_type}'...")

    # 2. Dynamic Attribute Selection
    requested_attributes = {}
    if clean_type == "DeFiTradingLicense":
        requested_attributes = {
            "0_name_uuid": {"name": "name", "restrictions": [{"cred_def_id": config["cred_def_id"]}]},
            "0_role_uuid": {"name": "role", "restrictions": [{"cred_def_id": config["cred_def_id"]}]},
            "0_license_uuid": {"name": "license_id", "restrictions": [{"cred_def_id": config["cred_def_id"]}]}
        }
    elif clean_type == "PersonalAssistantID":
        requested_attributes = {
            "0_name_uuid": {"name": "name", "restrictions": [{"cred_def_id": config["cred_def_id"]}]},
            "0_assistant_uuid": {"name": "assistant_id", "restrictions": [{"cred_def_id": config["cred_def_id"]}]},
            "0_access_uuid": {"name": "access_level", "restrictions": [{"cred_def_id": config["cred_def_id"]}]}
        }
    elif clean_type == "MedicalProxyAuth":
        requested_attributes = {
            "0_patient_uuid": {"name": "patient_name", "restrictions": [{"cred_def_id": config["cred_def_id"]}]},
            "0_proxy_uuid": {"name": "proxy_name", "restrictions": [{"cred_def_id": config["cred_def_id"]}]},
            "0_auth_uuid": {"name": "authorization_id", "restrictions": [{"cred_def_id": config["cred_def_id"]}]}
        }
    else:
        requested_attributes = {
            "0_name_uuid": {"name": "name", "restrictions": [{"cred_def_id": config["cred_def_id"]}]}
        }

    # 3. Construct Proof Request
    # CRITICAL: We set the 'name' field. This is our state that ACA-Py persists for us.
    proof_request_name = f"Verify {clean_type}"
    
    proof_request = {
        "name": proof_request_name,
        "version": "1.0",
        "requested_attributes": requested_attributes,
        "requested_predicates": {}
    }

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(
                f"{ACAPY_ADMIN_URL}/present-proof-2.0/send-request",
                json={
                    "connection_id": connection_id,
                    "presentation_request": {"indy": proof_request}
                }
            )
            
            if res.status_code != 200:
                print(f"❌ ACA-Py Error: {res.text}")
                raise HTTPException(status_code=500, detail="Failed to send proof request")

            pres_ex_id = res.json()["pres_ex_id"]
            print(f"✅ Proof Request Sent! Exchange ID: {pres_ex_id}")
            
            return {
                "status": "sent",
                "presentation_exchange_id": pres_ex_id,
                "message": "Notification sent to phone."
            }
        except Exception as e:
            print(f"❌ P4 FAILED: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.get("/protocol4/check-proof/{pres_ex_id}")
async def check_proof_status(pres_ex_id: str):
    """
    Step 2: Poll status using ACA-Py as the SOURCE OF TRUTH (Stateless).
    """
    async with httpx.AsyncClient() as client:
        try:
            # 1. Fetch Record
            res = await client.get(f"{ACAPY_ADMIN_URL}/present-proof-2.0/records/{pres_ex_id}")
            if res.status_code != 200: return {"status": "pending", "state": "searching"}
            
            record = res.json()
            state = record.get("state")
            verified_raw = record.get("verified", "false")
            is_crypto_valid = str(verified_raw).lower() == "true"
            connection_id = record.get("connection_id")
            
            # --- 2. STATELESS TYPE EXTRACTION (THE FIX) ---
            # We dig into the JSON to find the "name" field we set in request_proof
            claim_type = None
            
            # Path A: Standard
            try:
                pres_req = record.get("presentation_request", {}).get("indy", {})
                req_name = pres_req.get("name")
                if req_name and "Verify " in req_name:
                    claim_type = req_name.replace("Verify ", "").strip()
            except: pass

            # Path B: 'by_format' (Common in some ACA-Py versions)
            if not claim_type:
                try:
                    pres_req_alt = record.get("by_format", {}).get("pres_request", {}).get("indy", {})
                    req_name = pres_req_alt.get("name")
                    if req_name and "Verify " in req_name:
                        claim_type = req_name.replace("Verify ", "").strip()
                except: pass
            
            # Fallback if extraction totally fails (should not happen if paths are correct)
            if not claim_type:
                # Last resort: Sniff attributes
                try:
                    # Try Standard Path
                    req_attrs = record.get("presentation_request", {}).get("indy", {}).get("requested_attributes", {})
                    if not req_attrs:
                        # Try 'by_format' Path
                        req_attrs = record.get("by_format", {}).get("pres_request", {}).get("indy", {}).get("requested_attributes", {})
                    
                    if "0_assistant_uuid" in req_attrs: claim_type = "PersonalAssistantID"
                    elif "0_patient_uuid" in req_attrs: claim_type = "MedicalProxyAuth"
                    elif "0_license_uuid" in req_attrs: claim_type = "DeFiTradingLicense"
                except: pass

            # Safety Default
            if not claim_type:
                print(f"⚠️ Warning: Could not detect type from ACA-Py Record. Defaulting to DeFi.")
                claim_type = "DeFiTradingLicense"

            # --- 3. DUAL LAYER CHECK ---
            # if (state == "done" or state == "presentation-received") and is_crypto_valid:
                
            #     print(f"🔹 Layer 1 (Crypto) Passed. Detected Type: '{claim_type}'")
                
            #     short_id = connection_id.strip()[:8]
            # ledger_key = f"cred_{short_id}_{claim_type}"
            # print(f"   Checking Blockchain for '{ledger_key}'...")
            #     ledger_hash = w3.keccak(text=ledger_key)
            if (state == "done" or state == "presentation-received") and is_crypto_valid:
                # 1. Extract the revealed unique ID from the ZK Proof
                revealed_attrs = record.get("by_format", {}).get("pres", {}).get("indy", {}).get("requested_proof", {}).get("revealed_attrs", {})
                
                unique_id = "unknown"
                for key, val in revealed_attrs.items():
                    if "license" in key or "assistant" in key or "auth" in key:
                        unique_id = val.get("raw")
                        break
                
                print(f"🔹 Proof Valid! Checking Blockchain for ID: {unique_id}")
                
                # 2. Hash the exact same ID the Issuer used
                ledger_hash = w3.keccak(text=f"cred_{unique_id}")
                
                chain_status = cred_contract.functions.verifyCredential(ledger_hash).call()
                print(f"   🔎 Chain Status: {chain_status[1]}")

                # FAIL 1: REVOKED
                if chain_status[1] == "Revoked":
                    print(f"   ⛔ SECURITY ALERT: {claim_type} is Revoked!")
                    return {
                        "status": "failed",
                        "verified": False,
                        "details": f"Blockchain Check Failed: {claim_type} is REVOKED"
                    }
                
                # FAIL 2: MISSING (Strict Mode)
                elif chain_status[0] == False:
                    print(f"   ⛔ SECURITY ALERT: Anchor Missing")
                    return {
                        "status": "failed",
                        "verified": False,
                        "details": f"Blockchain Anchor Missing: Credential not found on Ledger"
                    }

                # SUCCESS
                return {
                    "status": "verified",
                    "verified": True,
                    "details": f"Dual-Layer Verification Passed ({claim_type})"
                }

            elif verified_raw == "false" and state == "done":
                 return {"status": "failed", "verified": False, "details": "Invalid Proof Signature"}
            else:
                return {"status": "pending", "state": state}

        except Exception as e:
            print(f"❌ CHECK FAILED: {e}")
            raise HTTPException(status_code=500, detail=str(e))
def process_proof_record(data):
    state = data.get("state")
    verified_raw = data.get("verified", "false")
    is_verified = str(verified_raw).lower() == "true"

    # With auto-verify, state usually jumps to 'done' or 'presentation-received'
    if state == "done" or (state == "presentation-received" and is_verified):
        return {
            "status": "verified",
            "verified": True,
            "details": "Cryptographic Proof Validated"
        }
    elif verified_raw == "false" and state == "done":
         return {
            "status": "failed",
            "verified": False,
            "details": "Invalid Proof Signature"
        }
    else:
        return {
            "status": "pending",
            "state": state
        }
# --- PROTOCOL 5: GOVERNANCE / REVOCATION ---
# --- PROTOCOL 5: GOVERNANCE / REVOCATION ---


# 2. DATABASE HELPER (Update agent_keys.json with the new Smart Wallet Address)
@app.post("/protocol6/delegate")
async def set_delegation(req: DelegateRequest):
    print(f"\n--- 🤝 PROTOCOL 6: SETTING DELEGATION POLICY ---")
    try:
        # 1. Resolve Agent DID -> EOA Address
        agent_data = get_agent_key(req.agent_did)
        if not agent_data:
            raise HTTPException(status_code=404, detail="Agent DID not found. Register in P2 first.")
        
        agent_eoa = agent_data["address"]
        print(f"🔹 Agent DID: {req.agent_did}")
        print(f"🔹 Resolved EOA: {agent_eoa}")

        # 2. Define Policy on Blockchain
        limit_wei = w3.to_wei(req.spend_limit_eth, 'ether')
        
        delegation_contract = w3.eth.contract(address=DELEGATION_REGISTRY_ADDRESS, abi=DELEGATION_ABI)
        
        # The Owner (Account 0 acting as Owner) sets the rule
        # "I authorize [AgentEOA] to spend up to [Limit]"
        tx = delegation_contract.functions.setPermission(
            agent_eoa,
            limit_wei,
            req.duration_seconds
        ).build_transaction({
            'from': req.owner_address,
            'nonce': w3.eth.get_transaction_count(req.owner_address),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        
        # signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
          
        # raw_tx = None
        # if hasattr(signed_tx, "rawTransaction"):
        #     raw_tx = signed_tx.rawTransaction
        # elif hasattr(signed_tx, "raw_transaction"):
        #     raw_tx = signed_tx.raw_transaction
        # elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
        #     raw_tx = signed_tx["rawTransaction"]
        # else:
        #     # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
        #     try:
        #         raw_tx = signed_tx[0]
        #     except:
        #         pass

        # if raw_tx is None:
        #     raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # # Send to Blockchain
        # tx_hash = w3.eth.send_raw_transaction(raw_tx)
        # receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        tx_hash, receipt = send_tx(tx)
        
        print(f"✅ Policy Anchored on Chain: {w3.to_hex(tx_hash)}")
        return {
            "status": "success", 
            "tx_hash": w3.to_hex(tx_hash), 
            "authorized_agent": agent_eoa
        }

    except Exception as e:
        print(f"❌ DELEGATION FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 2. EXECUTION (Layer D Enforcement) ---
@app.post("/protocol6/execute-trade")
async def execute_trade(req: TradeRequest):
    print(f"\n--- ⚙️ PROTOCOL 6: AGENT EXECUTION ---")
    try:
        # 1. Retrieve Credentials from Enclave
        agent_data = get_agent_key(req.agent_did)
        if not agent_data: raise HTTPException(status_code=404, detail="Agent not found")
        
        agent_private_key = agent_data["private_key"]
        agent_eoa = agent_data["address"]
        amount_wei = w3.to_wei(req.amount_eth, 'ether')

        # 2. POLICY CHECK (The Core of Layer D)
        # Before we sign anything, we query the Smart Contract: "Is this permitted?"
        delegation_contract = w3.eth.contract(address=DELEGATION_REGISTRY_ADDRESS, abi=DELEGATION_ABI)
        owner_address = w3.eth.accounts[0] # Assuming Admin is owner for demo flow
        
        # Read permission struct: (active, limit, expiry)
        perm = delegation_contract.functions.permissions(owner_address, agent_eoa).call()
        is_active = perm[0]
        limit = perm[1]
        expiry = perm[2]
        
        current_time = w3.eth.get_block('latest')['timestamp']
        
        print(f"🔹 Policy Check: Active={is_active}, Limit={w3.from_wei(limit,'ether')}, Expiry={expiry}")
        
        # ENFORCEMENT LOGIC
        if not is_active:
             return {"status": "denied", "reason": "Policy Inactive or Revoked"}
        if current_time > expiry:
             return {"status": "denied", "reason": "Policy Expired"}
        if amount_wei > limit:
             return {"status": "denied", "reason": f"Amount ({req.amount_eth}) Exceeds Limit ({w3.from_wei(limit,'ether')})"}

        print("✅ Policy Check Passed. Proceeding to Execution.")

        # 3. EXECUTION (The Agent Signs)
        # The Agent sends ETH directly from its own EOA wallet
        tx = {
            'to': "0x000000000000000000000000000000000000dEaD", # Burn address simulates trade
            'value': amount_wei,
            'gas': 21000,
            'gasPrice': w3.to_wei('1', 'gwei'),
            'nonce': w3.eth.get_transaction_count(agent_eoa),
        }
        
        # signed_tx = w3.eth.account.sign_transaction(tx, agent_private_key)
        
        # raw_tx = None
        # if hasattr(signed_tx, "rawTransaction"):
        #     raw_tx = signed_tx.rawTransaction
        # elif hasattr(signed_tx, "raw_transaction"):
        #     raw_tx = signed_tx.raw_transaction
        # elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
        #     raw_tx = signed_tx["rawTransaction"]
        # else:
        #     # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
        #     try:
        #         raw_tx = signed_tx[0]
        #     except:
        #         pass

        # if raw_tx is None:
        #     raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # # Send to Blockchain
        # tx_hash = w3.eth.send_raw_transaction(raw_tx)
        # receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        tx_hash, receipt = send_tx(tx, agent_private_key)
        
        print(f"✅ Trade Executed! Hash: {w3.to_hex(tx_hash)}")
        return {"status": "success", "tx_hash": w3.to_hex(tx_hash)}

    except Exception as e:
        print(f"⛔ ERROR: {e}")
        return {"status": "error", "reason": str(e)}

@app.get("/protocol6/inspect/{owner}/{agent_did}")
async def inspect_delegation(owner: str, agent_did: str):
    try:
        agent_data = get_agent_key(agent_did)
        if not agent_data: return {"status": "error", "reason": "Agent not found"}
        
        agent_addr = w3.to_checksum_address(agent_data["address"])
        owner_addr = w3.to_checksum_address(owner)
        
        delegation_contract = w3.eth.contract(address=DELEGATION_REGISTRY_ADDRESS, abi=DELEGATION_ABI)
        data = delegation_contract.functions.permissions(owner_addr, agent_addr).call()
        
        limit_eth = w3.from_wei(data[1], 'ether')
        expiry_ts = data[2]
        time_remaining = expiry_ts - int(datetime.now().timestamp())
        
        return {
            "status": "success",
            "on_chain_data": {
                "active": data[0],
                "limit_eth": limit_eth,
                "seconds_remaining": time_remaining if time_remaining > 0 else 0,
                "agent_eoa": agent_addr
            }
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}
# --- PROTOCOL 7: AUDIT & FORENSICS ---
# ... imports ...





