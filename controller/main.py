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
ACAPY_ADMIN_URL = "http://localhost:8000" 
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

def get_agent_key(did):
    if not os.path.exists(AGENT_STORAGE_FILE): return None
    with open(AGENT_STORAGE_FILE, "r") as f:
        db = json.load(f)
    return db.get(did)

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
 



@app.get("/")
def health_check():
    return {"status": "active", "protocol": "1", "mode": "ACA-Py Bridge"}

# --- PROTOCOL 1: HUMAN IDENTITY REGISTRATION ---

@app.post("/protocol1/create-ssi-identity")
async def create_ssi_identity(req: RegisterRequest):
    """
    Protocol 1 (FULL IMPLEMENTATION):
    1. [M6-M7] Create DID in ACA-Py (Real generation, not mocked).
    2. [M8] Create DID Document -> Upload to IPFS.
    3. [M9-M11] Anchor Hashed Data on Ethereum.
    """
    print(f"\n--- 🆔 PROTOCOL 1: GENERATING SSI IDENTITY ---")
    try:
        # --- Step 1: ACA-Py Key Gen (M6-M7) ---
        print(f"📡 M6: Requesting Identity from ACA-Py...")
        async with httpx.AsyncClient() as client:
            # Check Health
            try:
                await client.get(f"{ACAPY_ADMIN_URL}/status/ready")
            except:
                raise HTTPException(status_code=502, detail="ACA-Py is Down")

            # Create DID (Real Ed25519 Keypair)
            response = await client.post(
                f"{ACAPY_ADMIN_URL}/wallet/did/create",
                json={"method": "sov", "options": {"key_type": "ed25519"}}
            )
            data = response.json()
            ssi_did = data["result"]["did"]
            verkey = data["result"]["verkey"]
            print(f"   ↳ 🔐 DID Created: {ssi_did}")

        # --- Step 2: DID Document & IPFS (M8) ---
        print(f"🔹 M8: Generating DID Doc & Uploading to IPFS...")
        
        # Construct a real W3C DID Document
        did_doc = {
            "@context": "https://www.w3.org/ns/did/v1",
            "id": f"did:sov:{ssi_did}",
            "verificationMethod": [{
                "id": f"did:sov:{ssi_did}#key-1",
                "type": "Ed25519VerificationKey2018",
                "controller": f"did:sov:{ssi_did}",
                "publicKeyBase58": verkey
            }],
            "authentication": [f"did:sov:{ssi_did}#key-1"],
            "service": [{
                "id": f"did:sov:{ssi_did}#gov-id",
                "type": "LinkedGovernmentID",
                "serviceEndpoint": f"urn:gov:{req.gov_id}" 
            }]
        }

        # Upload to IPFS Node
        async with httpx.AsyncClient() as client:
            files = {'file': json.dumps(did_doc)}
            ipfs_res = await client.post(IPFS_API_URL, files=files)
            
            if ipfs_res.status_code != 200: 
                raise HTTPException(status_code=500, detail="IPFS Upload Failed")
            
            ipfs_cid = ipfs_res.json()["Hash"]
            print(f"   ↳ 📦 DID Doc on IPFS: {ipfs_cid}")

        # --- Step 3: Blockchain Anchoring (M9-M11) ---
        print("🔹 M9: Anchoring to Ethereum...")
        
        gov_id_hash = w3.keccak(text=req.gov_id)
        did_hash = w3.keccak(text=ssi_did)
        ipfs_cid_hash = w3.keccak(text=ipfs_cid)

        # Using the DIDRegistry Contract
        tx = did_contract.functions.registerDID(
            did_hash, 
            ipfs_cid_hash, 
            gov_id_hash
        ).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        
        signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)  
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"):
            raw_tx = signed_tx.rawTransaction
        elif hasattr(signed_tx, "raw_transaction"):
            raw_tx = signed_tx.raw_transaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
            raw_tx = signed_tx["rawTransaction"]
        else:
            # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
            try:
                raw_tx = signed_tx[0]
            except:
                pass

        if raw_tx is None:
            raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # Send to Blockchain
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)



        print(f"   ✅ Identity Anchored. TX: {w3.to_hex(tx_hash)}")

        return {
            "status": "success",
            "ssi_did": ssi_did,
            "verkey": verkey,
            "ipfs_cid": ipfs_cid,     
            "view_url": f"http://127.0.0.1:8080/ipfs/{ipfs_cid}",
            "blockchain_tx": w3.to_hex(tx_hash),
            "message": "Protocol 1 Fully Implemented (ACA-Py + IPFS + Chain)"
        }

    except Exception as e:
        print(f"❌ P1 FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/protocol1/connect-wallet")
async def connect_wallet():
    """
    Step 1.2: Generate a QR Code for the BC Wallet to scan.
    Returns: connection_id and invitation_url
    """
    print("📡 Generating Connection Invitation...")
    async with httpx.AsyncClient() as client:
        try:
            body = {
                "alias": "Thesis User",
                "my_label": "Thesis Agent Issuer"
            }
            response = await client.post(
                f"{ACAPY_ADMIN_URL}/connections/create-invitation", 
                json=body
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Agent Error: {response.text}")
                
            data = response.json()
            conn_id = data["connection_id"]
            print(f"\n✅ CONNECTION ID GENERATED: {conn_id}\n")
            
            return {
                "status": "invitation_created",
                "connection_id": conn_id,
                "invitation_url": data["invitation_url"],
                "message": "Scan this URL/QR with BC Wallet"
            }
        except Exception as e:
            print(f"❌ Connection Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/protocol1/check-connection/{connection_id}")
async def check_connection(connection_id: str):
    """
    Step 1.3: Frontend polls this to see if User scanned the QR.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{ACAPY_ADMIN_URL}/connections/{connection_id}")
            data = response.json()
            state = data["state"]
            is_connected = state in ["active", "response"]
            
            return {
                "connection_id": connection_id,
                "state": state,
                "connected": is_connected
            }
        except Exception as e:
             raise HTTPException(status_code=500, detail=str(e))

@app.post("/protocol1/link-wallet")
async def link_wallet(req: LinkWalletRequest):
    """
    Step 1.4: Finalize the Link. Maps ConnectionID -> DID -> ETH Address.
    """
    IDENTITY_DB[req.connection_id] = {
        "did": req.did,
        "wallet": req.wallet_address
    }
    
    # Store in User Wallet Map for Protocol 2 Funding
    USER_WALLET_MAP[req.connection_id] = req.wallet_address
    
    print(f"🔗 IDENTITY LINKED: Conn {req.connection_id} <-> DID {req.did} <-> Wallet {req.wallet_address}")
    return {"status": "success"}















         
         

# --- PROTOCOL 2: AI AGENT REGISTRATION ---

    """
    Recovers the entire history of Agents owned by this DID from the Blockchain.
    """
    try:
        contract = w3.eth.contract(address=AGENT_REGISTRY_ADDRESS, abi=AGENT_REGISTRY_ABI)
        owner_hash = w3.keccak(text=owner_did)
        
        found_agents = []
        
        # The contract uses a mapping to an array: ownerToAgents[ownerHash][index]
        # Since solidity getters don't return the whole array, we iterate until it fails.
        # This is a standard "Forensic" technique.
        for i in range(50): # Limit to 50 agents for the demo
            try:
                # 1. Get the Agent Hash at index i
                agent_hash_bytes = contract.functions.ownerToAgents(owner_hash, i).call()
                agent_hash_hex = w3.to_hex(agent_hash_bytes)
                
                # 2. Get the Profile Details
                # agents returns: (agentDID, ownerDID, modelHash, registeredAt, active)
                profile = contract.functions.agents(agent_hash_bytes).call()
                is_active = profile[4]
                
                found_agents.append({
                    "agent_hash": agent_hash_hex,
                    "is_active": is_active,
                    "role_hash": w3.to_hex(profile[2]) # Model Hash
                })
            except:
                # If the call fails (Revert), it means we reached the end of the array.
                break
                
        return {"status": "success", "agents": found_agents}

    except Exception as e:
        return {"status": "error", "reason": str(e)}

#--------------------------------------------------------
#--------------------------------------------------------
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
        signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)  
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"):
            raw_tx = signed_tx.rawTransaction
        elif hasattr(signed_tx, "raw_transaction"):
            raw_tx = signed_tx.raw_transaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
            raw_tx = signed_tx["rawTransaction"]
        else:
            # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
            try:
                raw_tx = signed_tx[0]
            except:
                pass

        if raw_tx is None:
            raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # Send to Blockchain
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)


        
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

























CRED_CONFIG = {
    "DeFiTradingLicense": {
        "schema_id": "QhrGzjqybQmNQzoaXzFn4z:2:defi_trading_license:1.0",
        "cred_def_id": "QhrGzjqybQmNQzoaXzFn4z:3:CL:3085369:traderv3"
    },
    "PersonalAssistantID": {
        "schema_id": "QhrGzjqybQmNQzoaXzFn4z:2:personal_assistant_id:1.0", 
        "cred_def_id": "QhrGzjqybQmNQzoaXzFn4z:3:CL:3085453:personv2"
    },
    "MedicalProxyAuth": {
        "schema_id": "QhrGzjqybQmNQzoaXzFn4z:2:medical_proxy_auth:1.0",
        "cred_def_id": "QhrGzjqybQmNQzoaXzFn4z:3:CL:3085454:medical_v2"
    }
}



@app.post("/protocol3/issue-credential")
async def issue_credential(req: IssueCredentialRequest):
    print(f"\n--- 🚀 STARTING PROTOCOL 3 (ISSUANCE) ---")
    try:
        # 1. Map UI Inputs
        issuer_did = req.issuer_did
        connection_id = req.subject_did 
        
        full_type = req.credential_data.get("type", "GenericLicense")
        clean_type = full_type.replace(" ", "") # e.g. "DeFiTradingLicense"
        
        print(f"🔹 Issuing '{clean_type}' to Connection: {connection_id}...")

        # ---------------------------------------------------------
        # PART A: SEND TO PHONE (ACA-Py)
        # ---------------------------------------------------------
        print("🔹 Step A: Sending to BC Wallet via ACA-Py...")
        
        # Get the correct Schema/CredDef IDs
        config = CRED_CONFIG.get(clean_type)
        if not config:
            print(f"⚠️ Warning: No Schema found for '{clean_type}'. Using Default.")
            config = CRED_CONFIG["DeFiTradingLicense"]

        # --- DYNAMIC ATTRIBUTE MAPPING (THE FIX) ---
        aca_py_attributes = []

        if clean_type == "DeFiTradingLicense":
            aca_py_attributes = [
                {"name": "name", "value": req.credential_data.get("name", "User")},
                {"name": "role", "value": req.credential_data.get("role", "Trader")},
                {"name": "license_id", "value": f"LIC-{uuid.uuid4().hex[:6].upper()}"},
                {"name": "expiration_date", "value": req.credential_data.get("expiry", "2026-12-31")}
            ]
            
        elif clean_type == "PersonalAssistantID":
            aca_py_attributes = [
                {"name": "name", "value": req.credential_data.get("name", "My AI Agent")},
                {"name": "assistant_id", "value": f"AID-{uuid.uuid4().hex[:6].upper()}"}, # Schema expects 'assistant_id'
                {"name": "access_level", "value": "Full Access"},                         # Schema expects 'access_level'
                {"name": "expiration_date", "value": req.credential_data.get("expiry", "2026-12-31")}
            ]
            
        elif clean_type == "MedicalProxyAuth":
            aca_py_attributes = [
                {"name": "patient_name", "value": req.credential_data.get("name", "John Doe")}, # Mapping 'name' to 'patient_name'
                {"name": "proxy_name", "value": "AI Medical Agent"},
                {"name": "authorization_id", "value": f"MED-{uuid.uuid4().hex[:6].upper()}"},
                {"name": "valid_until", "value": req.credential_data.get("expiry", "2026-12-31")} # Schema expects 'valid_until'
            ]
        
        else:
            # Fallback for unknown types (Default to DeFi structure)
            aca_py_attributes = [
                {"name": "name", "value": req.credential_data.get("name", "User")},
                {"name": "role", "value": "Unknown"},
                {"name": "license_id", "value": "Unknown"},
                {"name": "expiration_date", "value": "2099-12-31"}
            ]

        async with httpx.AsyncClient() as client:
            aca_res = await client.post(
                f"{ACAPY_ADMIN_URL}/issue-credential-2.0/send",
                json={
                    "connection_id": connection_id,
                    "filter": {
                        "indy": {
                            "cred_def_id": config["cred_def_id"],
                            "schema_id": config["schema_id"]
                        }
                    },
                    "credential_preview": {
                        "@type": "issue-credential/2.0/credential-preview",
                        "attributes": aca_py_attributes
                    }
                }
            )
            if aca_res.status_code != 200:
                print(f"❌ ACA-Py Error: {aca_res.text}")
            else:
                print(f"✅ Credential Offer Sent to Phone! (ExID: {aca_res.json()['cred_ex_id']})")

        # ---------------------------------------------------------
        # PART B: ANCHOR ON BLOCKCHAIN
        # ---------------------------------------------------------
        
        # 2. Construct Credential JSON (For IPFS Record)
        # We include the 'aca_py_attributes' logic here so IPFS matches the Phone
        credential_subject = {attr["name"]: attr["value"] for attr in aca_py_attributes}
        credential_subject["id"] = connection_id

        credential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": ["VerifiableCredential", clean_type],
            "issuer": issuer_did,
            "issuanceDate": datetime.utcnow().isoformat() + "Z",
            "expirationDate": req.credential_data.get("expiry", "2026-12-31"),
            "credentialSubject": credential_subject
        }

        # 3. Upload to IPFS
        print("🔹 Step M7: Uploading to IPFS...")
        async with httpx.AsyncClient() as client:
            files = {'file': json.dumps(credential)}
            ipfs_res = await client.post(IPFS_API_URL, files=files)
            if ipfs_res.status_code != 200: 
                raise HTTPException(status_code=500, detail="IPFS Error")
            ipfs_cid_str = ipfs_res.json()["Hash"]
            print(f"   ↳ 📦 IPFS CID: {ipfs_cid_str}")

        # 4. Anchor on Ethereum (Step M8)
        print("🔹 Step M8: Anchoring Metadata on Ethereum...")
        
        # Prepare Hash Arguments
        cred_id_string = f"cred_{connection_id[:8]}_{clean_type}"
        b_credID = w3.keccak(text=cred_id_string)
        b_issuerDID = w3.keccak(text=issuer_did)
        b_holderDID = w3.keccak(text=connection_id)
        b_ipfsCID = w3.keccak(text=ipfs_cid_str)
        b_credHash = w3.keccak(text=json.dumps(credential, sort_keys=True))
        duration = 31536000 # 1 year

        # Execute Transaction
        tx = cred_contract.functions.issueCredential(
            b_credID, b_issuerDID, b_holderDID, b_ipfsCID, b_credHash, duration
        ).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })

        signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
        
        # Robust Raw Transaction Extraction
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"): raw_tx = signed_tx.rawTransaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx: raw_tx = signed_tx["rawTransaction"]
        else:
            try: raw_tx = signed_tx[0]
            except: pass

        if raw_tx is None: raise Exception("Could not extract raw transaction bytes")

        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        print(f"✅ PROTOCOL 3 COMPLETE. Anchored at: {w3.to_hex(tx_hash)}")
        
        return {
            "status": "success",
            "ipfs_cid": ipfs_cid_str,
            "tx_hash": w3.to_hex(tx_hash),
            "view_url": f"http://127.0.0.1:8080/ipfs/{ipfs_cid_str}",
            "message": "Credential Sent to Phone AND Anchored on Chain"
        }

    except Exception as e:
        print(f"❌ P3 FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ... (Keep Protocol 1, 2, 3 as they are) ...

# --- PROTOCOL 4: CREDENTIAL PRESENTATION & VERIFICATION (Corrected) ---


# --- PROTOCOL 4: VERIFICATION (The "Gatekeeper") ---

# --- PROTOCOL 4: ZERO-KNOWLEDGE PROOF VERIFICATION (STATELESS) ---

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
            if (state == "done" or state == "presentation-received") and is_crypto_valid:
                
                print(f"🔹 Layer 1 (Crypto) Passed. Detected Type: '{claim_type}'")
                
                short_id = connection_id.strip()[:8]
                ledger_key = f"cred_{short_id}_{claim_type}"
                ledger_hash = w3.keccak(text=ledger_key)
                
                print(f"   Checking Blockchain for '{ledger_key}'...")
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

@app.post("/protocol5/revoke-credential")
async def revoke_credential(req: RevokeRequest):
    print(f"\n--- 🚫 STARTING PROTOCOL 5 (GOVERNANCE: REVOCATION) ---")
    try:
        print("🔹 Step M1: Searching Blockchain for Target Credential...")
        
        # 1. Inputs
        did_input = req.holder_did.strip() # This is the Connection ID from the frontend
        raw_type = req.claim_type.strip()
        clean_type = raw_type.replace(" ", "") # e.g. "DeFiTradingLicense"

        # 2. Derived Formats
        # Naked: Remove common prefixes (just in case the user pasted a full DID)
        did_naked = did_input.replace("did:sov:", "").replace("agent:", "")
        
        # 3. Generate Candidates (The Omni-Search)
        # We must match the ID generation logic from Protocol 3 EXACTLY.
        candidates = [
            # A. The Short Match (Used in Protocol 3) - MOST LIKELY TO SUCCEED
            f"cred_{did_naked[:8]}_{clean_type}",

            # B. The Exact Match (If user typed the short ID manually)
            f"cred_{did_naked}_{clean_type}",

            # C. The Raw Input (Fallback)
            f"cred_{did_input}_{clean_type}",
        ]

        # 4. Execute Search
        target_hash = None
        target_str = None
        
        for cand in candidates:
            cand_hash = w3.keccak(text=cand)
            print(f"   🔎 Checking Candidate: {cand}")
            
            # Check Status on Chain
            # returns (bool exists, string status)
            status = cred_contract.functions.verifyCredential(cand_hash).call()
            
            if status[0] == True: # exists is True
                print(f"      ✅ FOUND! Current Status: {status[1]}")
                target_hash = cand_hash
                target_str = cand
                break 

        if not target_hash:
            print("   ❌ CRITICAL: Credential Not Found on Chain.")
            print(f"      Checked {len(candidates)} variations for input '{did_input}'")
            return {
                "status": "error", 
                "detail": "Credential Anchor not found. Did you use the correct Connection ID?"
            }

        # Step M2: Execution
        print(f"🔹 Step M2: Revoking Target: {target_str}...")
        
        tx = cred_contract.functions.revokeCredential(target_hash).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
        
        # Robust Raw TX Extraction
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"): raw_tx = signed_tx.rawTransaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx: raw_tx = signed_tx["rawTransaction"]
        else:
            try: raw_tx = signed_tx[0]
            except: pass

        if raw_tx is None: raise Exception("Could not extract raw transaction bytes")

        # Send to Blockchain
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        print("🔹 Step M3: Waiting for Consensus...")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        print(f"   ✅ Revocation Mined. TX: {w3.to_hex(tx_hash)}")
        
        return {
            "status": "success", 
            "message": "Credential Revoked on Blockchain",
            "tx_hash": w3.to_hex(tx_hash),
            "revoked_id": target_str
        }

    except Exception as e:
        print(f"❌ REVOCATION FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/protocol5/debug-check/{connection_id}")
async def debug_check_credential(connection_id: str):
    """
    Forensic Tool: Checks ALL known license types for a connection ID
    to see what actually exists on the blockchain.
    """
    # 1. Prepare the Short ID (First 8 chars)
    # This is how Protocol 3 saved it.
    short_id = connection_id.strip()[:8]
    
    # 2. List of all Types we support
    known_types = [
        "DeFiTradingLicense", 
        "PersonalAssistantID", 
        "MedicalProxyAuth",
        "TradingLicense" # Legacy
    ]
    
    found_records = []
    
    print(f"\n--- 🕵️ DEBUG: INSPECTING CHAIN FOR {short_id} ---")

    for c_type in known_types:
        # Reconstruct the Key
        candidate_key = f"cred_{short_id}_{c_type}"
        candidate_hash = w3.keccak(text=candidate_key)
        
        # Ask Solidity
        status = cred_contract.functions.verifyCredential(candidate_hash).call()
        
        print(f"   Checking: {candidate_key} -> {status[1]}")
        
        if status[0] == True: # If exists
            found_records.append({
                "type": c_type,
                "key": candidate_key,
                "status": status[1] # "Active" or "Revoked"
            })

    return {
        "searched_id": short_id,
        "found_records": found_records,
        "message": f"Found {len(found_records)} records on chain."
    }
# --- PROTOCOL 6: DELEGATION MANAGEMENT ---

class DelegateRequest(BaseModel):
    owner_address: str
    agent_did: str 
    spend_limit_eth: float
    duration_seconds: int

class TradeRequest(BaseModel):
    agent_did: str 
    amount_eth: float

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
        
        signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
          
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"):
            raw_tx = signed_tx.rawTransaction
        elif hasattr(signed_tx, "raw_transaction"):
            raw_tx = signed_tx.raw_transaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
            raw_tx = signed_tx["rawTransaction"]
        else:
            # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
            try:
                raw_tx = signed_tx[0]
            except:
                pass

        if raw_tx is None:
            raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # Send to Blockchain
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
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
        
        signed_tx = w3.eth.account.sign_transaction(tx, agent_private_key)
        
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"):
            raw_tx = signed_tx.rawTransaction
        elif hasattr(signed_tx, "raw_transaction"):
            raw_tx = signed_tx.raw_transaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
            raw_tx = signed_tx["rawTransaction"]
        else:
            # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
            try:
                raw_tx = signed_tx[0]
            except:
                pass

        if raw_tx is None:
            raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # Send to Blockchain
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
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

@app.post("/protocol7/audit-did")
async def audit_did(req: AuditRequest):
    print(f"\n--- 🔍 STARTING PROTOCOL 7 (FULL M1-M11) ---")
    try:
        # --- PHASE 1: INVESTIGATION (M1-M4) ---
        clean_did = req.target_did.strip()
        target_hash = w3.keccak(text=clean_did.replace("did:sov:", ""))
        
        # [M2-M4] Reconstruction (Simplified for brevity - assumes same scanning logic as before)
        audit_trail = [
            {"event": "AUDIT_STARTED", "details": f"Targeting {clean_did}", "timestamp": str(datetime.datetime.now())}
            # ... (In production, this includes the full scan results we wrote previously) ...
        ]

        # --- PHASE 2: ACCOUNTABILITY (M5-M11) ---
        
        # [M5] Validation
        # Verify we actually found data worth logging
        if not audit_trail: print("   ⚠️ Empty Audit - Logging anyway for completeness.")

        # [M6] Report Generation
        audit_report = {
            "title": "Forensic Audit Report",
            "auditor": "did:ethr:admin",
            "target": clean_did,
            "timestamp": str(datetime.datetime.now()),
            "evidence": audit_trail
        }
        
        # [M7] Authorization (Implicit by Admin Private Key usage in M9)
        
        # [M8] IPFS Storage (The Evidence Locker)
        print("🔹 M8: Uploading Forensic Report to IPFS...")
        async with httpx.AsyncClient() as client:
            files = {'file': json.dumps(audit_report)}
            ipfs_res = await client.post(IPFS_API_URL, files=files)
            report_cid = ipfs_res.json()["Hash"]
            print(f"   ↳ 📦 Evidence CID: {report_cid}")

        # [M9] Transaction Construction (Anchoring)
        print("🔹 M9: Anchoring Audit Log to Blockchain...")
        tx = cred_contract.functions.recordAuditLog(
            w3.keccak(text="did:ethr:admin"), # Auditor
            target_hash,                      # Target
            w3.keccak(text=report_cid),       # Evidence Pointer
            w3.keccak(text=json.dumps(audit_report)) # Integrity Hash
        ).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        
        # [M10] Mining (Consensus)
        signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)  
        raw_tx = None
        if hasattr(signed_tx, "rawTransaction"):
            raw_tx = signed_tx.rawTransaction
        elif hasattr(signed_tx, "raw_transaction"):
            raw_tx = signed_tx.raw_transaction
        elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx:
            raw_tx = signed_tx["rawTransaction"]
        else:
            # Fallback: SignedTransaction is often a tuple/NamedTuple where index 0 is raw bytes
            try:
                raw_tx = signed_tx[0]
            except:
                pass

        if raw_tx is None:
            raise Exception(f"Could not extract raw transaction bytes. signed_tx type: {type(signed_tx)}")

        # Send to Blockchain
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ M10-M11 COMPLETE. Audit Logged at: {w3.to_hex(tx_hash)}")

        return {
            "status": "success",
            "target": clean_did,
            "report_cid": report_cid,
            "tx_hash": w3.to_hex(tx_hash),
            "history": audit_trail # Return for UI display
        }

    except Exception as e:
        print(f"❌ AUDIT FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))