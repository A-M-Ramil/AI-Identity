from datetime import datetime
import json
import httpx
from web3 import Web3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uuid

# --- CONFIGURATION (ISSUER NODE) ---
# 1. Blockchain (Anvil)
ANVIL_RPC_URL = "http://127.0.0.1:8545"
# UPDATE THESE ADDRESSES AFTER DEPLOYING CONTRACTS!
DID_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" 
CREDENTIAL_REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"

# Account #0 Private Key (Admin/Deployer) - Pays for the registration gas
ADMIN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" 

# 2. ACA-Py (The Identity Authority)
ACAPY_ADMIN_URL = "http://127.0.0.1:8020" # <--- Node A (Issuer) Port
IPFS_API_URL = "http://127.0.0.1:5001/api/v0/add"

# Local DBs
USER_WALLET_MAP = {}
IDENTITY_DB = {}
CRED_CONFIG = {
    "DeFiTradingLicense": {
        "schema_id": "BEjT63Lpv7ZuMbrmbUNwqx:2:defi_trading_license:1.7714",
        "cred_def_id": "BEjT63Lpv7ZuMbrmbUNwqx:3:CL:3329685:tag_7714"
    },
    "PersonalAssistantID": {
        "schema_id": "BEjT63Lpv7ZuMbrmbUNwqx:2:personal_assistant_id:1.7722",
        "cred_def_id": "BEjT63Lpv7ZuMbrmbUNwqx:3:CL:3329687:tag_7722"
    },
    "MedicalProxyAuth": {
        "schema_id": "BEjT63Lpv7ZuMbrmbUNwqx:2:medical_proxy_auth:1.7737",
        "cred_def_id": "BEjT63Lpv7ZuMbrmbUNwqx:3:CL:3329689:tag_7737"
    }
}
# --- PYDANTIC MODELS (Strictly Identity & Issuance) ---
class RegisterRequest(BaseModel):
    gov_id: str
    name: str

class LinkWalletRequest(BaseModel):
    connection_id: str
    wallet_address: str
    did: str

class IssueCredentialRequest(BaseModel):
    issuer_did: str          
    subject_did: str         
    credential_data: dict    
    
class RevokeRequest(BaseModel):
    holder_did: str
    claim_type: str
    
    

# --- INITIALIZATION ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

w3 = Web3(Web3.HTTPProvider(ANVIL_RPC_URL))

# --- LOAD CONTRACTS (Strictly Identity & Credential) ---
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
try:
    with open("DIDRegistry.json", "r") as f:
        did_abi = json.load(f)["abi"]
    did_contract = w3.eth.contract(address=DID_REGISTRY_ADDRESS, abi=did_abi)
    print("✅ Blockchain Connected")
except Exception as e:
    print(f"❌ Contract Loading Error: {e}")
    
        
    
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
    
def send_tx(tx):
    signed = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
    raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    if receipt.status != 1:
        raise HTTPException(status_code=409,
            detail=f"Reverted on-chain: {w3.to_hex(tx_hash)}")
    return tx_hash, receipt

@app.get("/")
def health_check():
    return {"status": "active", "protocol": "1", "mode": "ACA-Py Bridge"}


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









# @app.post("/protocol3/issue-credential")
# async def issue_credential(req: IssueCredentialRequest):
#     print(f"\n--- 🚀 STARTING PROTOCOL 3 (ISSUANCE) ---")
#     try:
#         # 1. Map UI Inputs
#         issuer_did = req.issuer_did
#         connection_id = req.subject_did 
        
#         full_type = req.credential_data.get("type", "GenericLicense")
#         clean_type = full_type.replace(" ", "") # e.g. "DeFiTradingLicense"
        
#         print(f"🔹 Issuing '{clean_type}' to Connection: {connection_id}...")

#         # ---------------------------------------------------------
#         # PART A: SEND TO PHONE (ACA-Py)
#         # ---------------------------------------------------------
#         print("🔹 Step A: Sending to BC Wallet via ACA-Py...")
        
#         # Get the correct Schema/CredDef IDs
#         config = CRED_CONFIG.get(clean_type)
#         if not config:
#             print(f"⚠️ Warning: No Schema found for '{clean_type}'. Using Default.")
#             config = CRED_CONFIG["DeFiTradingLicense"]

#         # --- DYNAMIC ATTRIBUTE MAPPING (THE FIX) ---
#         aca_py_attributes = []

#         if clean_type == "DeFiTradingLicense":
#             aca_py_attributes = [
#                 {"name": "name", "value": req.credential_data.get("name", "User")},
#                 {"name": "role", "value": req.credential_data.get("role", "Trader")},
#                 {"name": "license_id", "value": f"LIC-{uuid.uuid4().hex[:12].upper()}"},
#                 {"name": "expiration_date", "value": req.credential_data.get("expiry", "2026-12-31")}
#             ]
            
#         elif clean_type == "PersonalAssistantID":
#             aca_py_attributes = [
#                 {"name": "name", "value": req.credential_data.get("name", "My AI Agent")},
#                 {"name": "assistant_id", "value": f"AID-{uuid.uuid4().hex[:12].upper()}"}, # Schema expects 'assistant_id'
#                 {"name": "access_level", "value": "Full Access"},                         # Schema expects 'access_level'
#                 {"name": "expiration_date", "value": req.credential_data.get("expiry", "2026-12-31")}
#             ]
            
#         elif clean_type == "MedicalProxyAuth":
#             aca_py_attributes = [
#                 {"name": "patient_name", "value": req.credential_data.get("name", "John Doe")}, # Mapping 'name' to 'patient_name'
#                 {"name": "proxy_name", "value": "AI Medical Agent"},
#                 {"name": "authorization_id", "value": f"MED-{uuid.uuid4().hex[:12].upper()}"},
#                 {"name": "valid_until", "value": req.credential_data.get("expiry", "2026-12-31")} # Schema expects 'valid_until'
#             ]
        
#         else:
#             # Fallback for unknown types (Default to DeFi structure)
#             aca_py_attributes = [
#                 {"name": "name", "value": req.credential_data.get("name", "User")},
#                 {"name": "role", "value": "Unknown"},
#                 {"name": "license_id", "value": "Unknown"},
#                 {"name": "expiration_date", "value": "2099-12-31"}
#             ]

#         async with httpx.AsyncClient() as client:
#             aca_res = await client.post(
#                 f"{ACAPY_ADMIN_URL}/issue-credential-2.0/send",
#                 json={
#                     "connection_id": connection_id,
#                     "filter": {
#                         "indy": {
#                             "cred_def_id": config["cred_def_id"],
#                             "schema_id": config["schema_id"]
#                         }
#                     },
#                     "credential_preview": {
#                         "@type": "issue-credential/2.0/credential-preview",
#                         "attributes": aca_py_attributes
#                     }
#                 }
#             )
#             if aca_res.status_code != 200:
#                 print(f"❌ ACA-Py Error: {aca_res.text}")
#             else:
#                 print(f"✅ Credential Offer Sent to Phone! (ExID: {aca_res.json()['cred_ex_id']})")

#         # ---------------------------------------------------------
#         # PART B: ANCHOR ON BLOCKCHAIN
#         # ---------------------------------------------------------
        
#         # 2. Construct Credential JSON (For IPFS Record)
#         # We include the 'aca_py_attributes' logic here so IPFS matches the Phone
#         credential_subject = {attr["name"]: attr["value"] for attr in aca_py_attributes}
#         credential_subject["id"] = connection_id

#         credential = {
#             "@context": ["https://www.w3.org/2018/credentials/v1"],
#             "id": f"urn:uuid:{uuid.uuid4()}",
#             "type": ["VerifiableCredential", clean_type],
#             "issuer": issuer_did,
#             "issuanceDate": datetime.utcnow().isoformat() + "Z",
#             "expirationDate": req.credential_data.get("expiry", "2026-12-31"),
#             "credentialSubject": credential_subject
#         }

#         # 3. Upload to IPFS
#         print("🔹 Step M7: Uploading to IPFS...")
#         async with httpx.AsyncClient() as client:
#             files = {'file': json.dumps(credential)}
#             ipfs_res = await client.post(IPFS_API_URL, files=files)
#             if ipfs_res.status_code != 200: 
#                 raise HTTPException(status_code=500, detail="IPFS Error")
#             ipfs_cid_str = ipfs_res.json()["Hash"]
#             print(f"   ↳ 📦 IPFS CID: {ipfs_cid_str}")

#         # 4. Anchor on Ethereum (Step M8)
#         # print("🔹 Step M8: Anchoring Metadata on Ethereum...")
        
#         # # Prepare Hash Arguments
#         # cred_id_string = f"cred_{connection_id[:8]}_{clean_type}"
        
#         # Grab the unique ID (LIC-xxx, AID-xxx, or MED-xxx) from the attributes
#         unique_id = aca_py_attributes[2]["value"]
#         cred_id_string = f"cred_{unique_id}"
        
#         b_credID = w3.keccak(text=cred_id_string)
#         b_issuerDID = w3.keccak(text=issuer_did)
#         b_holderDID = w3.keccak(text=connection_id)
#         b_ipfsCID = w3.keccak(text=ipfs_cid_str)
#         b_credHash = w3.keccak(text=json.dumps(credential, sort_keys=True))
#         duration = 31536000 # 1 year

#         # Execute Transaction
#         tx = cred_contract.functions.issueCredential(
#             b_credID, b_issuerDID, b_holderDID, b_ipfsCID, b_credHash, duration
#         ).build_transaction({
#             'from': w3.eth.accounts[0],
#             'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
#             'gas': 2000000,
#             'gasPrice': w3.to_wei('1', 'gwei')
#         })

#         # signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
        
#         # # Robust Raw Transaction Extraction
#         # raw_tx = None
#         # if hasattr(signed_tx, "rawTransaction"): raw_tx = signed_tx.rawTransaction
#         # elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx: raw_tx = signed_tx["rawTransaction"]
#         # else:
#         #     try: raw_tx = signed_tx[0]
#         #     except: pass

#         # if raw_tx is None: raise Exception("Could not extract raw transaction bytes")

#         # tx_hash = w3.eth.send_raw_transaction(raw_tx)
#         # receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
#         tx_hash, receipt = send_tx(tx)

#         print(f"✅ PROTOCOL 3 COMPLETE. Anchored at: {w3.to_hex(tx_hash)}")
        
#         return {
#             "status": "success",
#             "ipfs_cid": ipfs_cid_str,
#             "tx_hash": w3.to_hex(tx_hash),
#             "view_url": f"http://127.0.0.1:8080/ipfs/{ipfs_cid_str}",
#             "message": "Credential Sent to Phone AND Anchored on Chain",
#             "license_id": unique_id  # <--- THIS WAS MISSING
#         }

#     except Exception as e:
#         print(f"❌ P3 FAILED: {e}")
#         raise HTTPException(status_code=500, detail=str(e))

ID_PREFIX = {"DeFiTradingLicense": "LIC", "PersonalAssistantID": "AID", "MedicalProxyAuth": "MED"}

@app.post("/protocol3/issue-credential")
async def issue_credential(req: IssueCredentialRequest):
    print("\n--- 🚀 STARTING PROTOCOL 3 (ISSUANCE) ---")
    try:
        issuer_did = req.issuer_did
        connection_id = req.subject_did
        clean_type = req.credential_data.get("type", "").replace(" ", "")
        config = CRED_CONFIG.get(clean_type)
        if not config:
            raise HTTPException(status_code=400, detail=f"Unknown credential type '{clean_type}'")

        cd = req.credential_data
        expiry = cd.get("expiry", "2026-12-31")
        # Generate the ID ONCE; it goes into the attributes AND the on-chain key
        unique_id = f"{ID_PREFIX[clean_type]}-{uuid.uuid4().hex[:12].upper()}"

        # 1. BUILD ATTRIBUTES
        if clean_type == "DeFiTradingLicense":
            attrs = [
                {"name": "name", "value": cd.get("name", "User")},
                {"name": "role", "value": cd.get("role", "Trader")},
                {"name": "license_id", "value": unique_id},
                {"name": "expiration_date", "value": expiry},
            ]
        elif clean_type == "PersonalAssistantID":
            attrs = [
                {"name": "name", "value": cd.get("name", "My AI Agent")},
                {"name": "assistant_id", "value": unique_id},
                {"name": "access_level", "value": "Full Access"},
                {"name": "expiration_date", "value": expiry},
            ]
        else:  # MedicalProxyAuth
            attrs = [
                {"name": "patient_name", "value": cd.get("name", "John Doe")},
                {"name": "proxy_name", "value": "AI Medical Agent"},
                {"name": "authorization_id", "value": unique_id},
                {"name": "valid_until", "value": expiry},
            ]

        credential_subject = {a["name"]: a["value"] for a in attrs}
        credential_subject["id"] = connection_id
        credential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": ["VerifiableCredential", clean_type],
            "issuer": issuer_did,
            "issuanceDate": datetime.utcnow().isoformat() + "Z",
            "expirationDate": expiry,
            "credentialSubject": credential_subject,
        }

        # 2. IPFS
        async with httpx.AsyncClient() as client:
            ipfs_res = await client.post(IPFS_API_URL, files={"file": json.dumps(credential)})
        if ipfs_res.status_code != 200:
            raise HTTPException(status_code=502, detail="IPFS upload failed")
        ipfs_cid = ipfs_res.json()["Hash"]

        # 3. ANCHOR ON-CHAIN (reverts raise before the phone is touched)
        b_credID = w3.keccak(text=f"cred_{unique_id}")
        tx = cred_contract.functions.issueCredential(
            b_credID,
            w3.keccak(text=issuer_did),
            w3.keccak(text=connection_id),
            w3.keccak(text=ipfs_cid),
            w3.keccak(text=json.dumps(credential, sort_keys=True)),
            31536000,
        ).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei'),
        })
        tx_hash, _ = send_tx(tx)

        # 4. DELIVER TO WALLET
        async with httpx.AsyncClient() as client:
            aca_res = await client.post(
                f"{ACAPY_ADMIN_URL}/issue-credential-2.0/send",
                json={
                    "connection_id": connection_id,
                    "filter": {"indy": {"cred_def_id": config["cred_def_id"],
                                        "schema_id": config["schema_id"]}},
                    "credential_preview": {
                        "@type": "issue-credential/2.0/credential-preview",
                        "attributes": attrs,
                    },
                },
            )

        if aca_res.status_code != 200:
            # Compensate: the anchor exists but the holder never got the credential
            try:
                rtx = cred_contract.functions.revokeCredential(b_credID).build_transaction({
                    'from': w3.eth.accounts[0],
                    'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
                    'gas': 2000000,
                    'gasPrice': w3.to_wei('1', 'gwei'),
                })
                send_tx(rtx)
            except Exception as ce:
                print(f"⚠️ Compensating revoke failed: {ce}")
            raise HTTPException(status_code=502,
                                detail=f"Wallet delivery failed (anchor rolled back): {aca_res.text}")

        print(f"✅ PROTOCOL 3 COMPLETE. Anchored at: {w3.to_hex(tx_hash)}")
        return {
            "status": "success",
            "ipfs_cid": ipfs_cid,
            "tx_hash": w3.to_hex(tx_hash),
            "view_url": f"http://127.0.0.1:8080/ipfs/{ipfs_cid}",
            "message": "Anchored on chain, then delivered to wallet",
            "license_id": unique_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ P3 FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PROTOCOL 5: REVOCATION
# ==========================================

@app.post("/protocol5/revoke")
async def revoke_credential(req: RevokeRequest):
    print(f"\n--- 🚫 STARTING PROTOCOL 5 (GOVERNANCE: REVOCATION) ---")
    try:
        # We are now revoking by the Unique License ID (e.g., LIC-123456)
        # Assuming you type the LIC- ID into the 'holder_did' input field in your UI
        unique_id = req.holder_did.strip() 
        
        print(f"🔹 Step M1: Searching Blockchain for Target Credential: {unique_id}...")
        
        # Hash exactly the way Protocol 3 and Protocol 4 do it
        target_str = f"cred_{unique_id}"
        target_hash = w3.keccak(text=target_str)
        
        # Check Status on Chain
        valid, status_str = cred_contract.functions.verifyCredential(target_hash).call()
        if status_str == "Not Found":
            return {"status": "error", "detail": f"'{target_str}' not found on chain"}
        if status_str == "Revoked":
            return {"status": "error", "detail": "Already revoked"}
            
        print(f"      ✅ FOUND! Current Status: {status_str}")
        
        print(f"🔹 Step M2: Revoking Target: {target_str}...")
        
        tx = cred_contract.functions.revokeCredential(target_hash).build_transaction({
            'from': w3.eth.accounts[0],
            'nonce': w3.eth.get_transaction_count(w3.eth.accounts[0]),
            'gas': 2000000,
            'gasPrice': w3.to_wei('1', 'gwei')
        })
        # signed_tx = w3.eth.account.sign_transaction(tx, ADMIN_PRIVATE_KEY)
        
        # # Robust Raw TX Extraction
        # raw_tx = None
        # if hasattr(signed_tx, "rawTransaction"): raw_tx = signed_tx.rawTransaction
        # elif isinstance(signed_tx, dict) and "rawTransaction" in signed_tx: raw_tx = signed_tx["rawTransaction"]
        # else:
        #     try: raw_tx = signed_tx[0]
        #     except: pass

        # if raw_tx is None: raise Exception("Could not extract raw transaction bytes")

        # # Send to Blockchain
        # tx_hash = w3.eth.send_raw_transaction(raw_tx)
        
        tx_hash, receipt = send_tx(tx)
        print("🔹 Step M3: Waiting for Consensus...")
        w3.eth.wait_for_transaction_receipt(tx_hash)
        
        print(f"   ✅ Revocation Mined. TX: {w3.to_hex(tx_hash)}")
        
        return {
            "status": "success", 
            "message": f"License {unique_id} Revoked on Blockchain",
            "tx_hash": w3.to_hex(tx_hash),
            "revoked_id": target_str
        }

    except Exception as e:
        print(f"❌ REVOCATION FAILED: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# @app.get("/protocol5/debug-check/{connection_id}")
# async def debug_check_credential(connection_id: str):
#     """
#     Forensic Tool: Checks ALL known license types for a connection ID
#     to see what actually exists on the blockchain.
#     """
#     # 1. Prepare the Short ID (First 8 chars)
#     # This is how Protocol 3 saved it.
#     short_id = connection_id.strip()[:8]
    
#     # 2. List of all Types we support
#     known_types = [
#         "DeFiTradingLicense", 
#         "PersonalAssistantID", 
#         "MedicalProxyAuth",
#         "TradingLicense" # Legacy
#     ]
    
#     found_records = []
    
#     print(f"\n--- 🕵️ DEBUG: INSPECTING CHAIN FOR {short_id} ---")

#     for c_type in known_types:
#         # Reconstruct the Key
#         candidate_key = f"cred_{short_id}_{c_type}"
#         candidate_hash = w3.keccak(text=candidate_key)
        
#         # Ask Solidity
#         status = cred_contract.functions.verifyCredential(candidate_hash).call()
        
#         print(f"   Checking: {candidate_key} -> {status[1]}")
        
#         if status[0] == True: # If exists
#             found_records.append({
#                 "type": c_type,
#                 "key": candidate_key,
#                 "status": status[1] # "Active" or "Revoked"
#             })

#     return {
#         "searched_id": short_id,
#         "found_records": found_records,
#         "message": f"Found {len(found_records)} records on chain."
#     }

@app.get("/protocol5/debug-check/{license_id}")
async def debug_check_credential(license_id: str):
    key = f"cred_{license_id.strip()}"
    valid, status = cred_contract.functions.verifyCredential(w3.keccak(text=key)).call()
    return {"key": key, "valid": valid, "status": status}
# --- PROTOCOL 6: DELEGATION MANAGEMENT ---







