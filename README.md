# DeAID: Prototype Implementation

This repository contains the prototype of **DeAID**, a dual-registry identity system that binds autonomous AI agents to accountable human owners and enforces each owner's spending policy on chain. It accompanies the paper *"DeAID: Dual-Registry Identity and On-Chain Delegation Enforcement for Autonomous AI Agents"* (under review).

The prototype implements six protocols:

| ID | Protocol | Implemented in |
|----|----------|----------------|
| P1 | Human identity registration | `issuer/backend` + `DIDRegistry` |
| P2 | AI agent identity registration (with agent proof of possession) | `verifier/backend` + `AgentRegistry` |
| P3 | Credential issuance (AnonCreds over DIDComm, on-chain status anchor) | `issuer/backend` + `CredentialRegistry` |
| P4 | Credential presentation and verification (zero-knowledge proof + on-chain status) | `verifier/backend` + `CredentialRegistry` |
| P5 | Credential revocation | `issuer/backend` + `CredentialRegistry` |
| P6 | Delegation and delegated execution (per-trade limit, total budget, expiry) | `verifier/backend` + `DelegationRegistry` + `AgentWallet` |

> **Scope.** Government-ID verification is simulated, and onboarding is custodial: the issuer service holds users' DID keys and the agent service holds agent keys. Biometric liveness and compliance logging are designed but not implemented.

---

## Repository layout

```
.
├── contracts/            Foundry project (Solidity 0.8.25, Paris EVM)
│   ├── src/              DIDRegistry, AgentRegistry, CredentialRegistry,
│   │                     DelegationRegistry, AgentWallet
│   ├── script/           Deploy.s.sol (deploys all five contracts)
│   └── test/             Foundry tests
├── issuer/
│   ├── backend/          FastAPI service: P1, P3, P5 (main.py + contract ABIs)
│   └── frontend/         Next.js UI for registration and credential issuance
├── verifier/
│   ├── backend/          FastAPI service: P2, P4, P6 (main.py + contract ABIs)
│   └── frontend/         Next.js UI for agents, verification and delegation
└── docker-compose.yml    Supporting services (see below)
```

### Smart contracts

| Contract | Role |
|----------|------|
| `DIDRegistry` | Anchors human DIDs. Accepts registrations only from the registrar account and rejects any government-ID commitment (HMAC-SHA256) already used. |
| `AgentRegistry` | Binds an agent's DID, address and model fingerprint to an owner DID. Requires the agent's signature over a domain-separated binding digest. The owner can deactivate an agent. |
| `CredentialRegistry` | Records credential status (valid, revoked, expired). Writable only by the issuer; credential identifiers are single-use. |
| `DelegationRegistry` | Stores each owner's delegation to an agent: per-trade limit, total budget, expiry and epoch. |
| `AgentWallet` | The owner's vault. On every trade it checks that the caller is a registered, active agent of the owner, that the delegation is active and unexpired, and that the amount fits the per-trade limit and remaining budget. |

Agents hold only gas; funds stay in `AgentWallet`.

---

## Requirements

| Component | Version used |
|-----------|--------------|
| Foundry (`forge`, `anvil`) | Anvil 0.2.0 |
| Python | 3.10+ (`fastapi`, `uvicorn`, `httpx`, `web3` 7.14) |
| Node.js | 18+ (Next.js frontends) |
| Docker + Docker Compose | any recent version |
| ACA-Py | 1.2.0 (one agent for the issuer, one for the verifier) |
| IPFS | Kubo 0.39 |
| Mobile wallet | BC Wallet (Android or iOS) |
| Public tunnel | ngrok or similar, so the phone can reach the ACA-Py agents |

AnonCreds schemas and credential definitions are published on the BCovrin Test Indy ledger, which BC Wallet supports.

### Default ports

| Service | Port |
|---------|------|
| Anvil JSON-RPC | 8545 |
| IPFS API | 5001 |
| ACA-Py issuer admin API | 8020 |
| ACA-Py verifier admin API | 8030 |
| Verifier backend | 8012 |
| Issuer backend | `<ISSUER_BACKEND_PORT>` |

---

## Quick start

All commands run from the repository root unless stated otherwise.

### 1. Start a fresh local chain and deploy the contracts

```bash
anvil                                   # terminal 1, keep running

cd contracts                            # terminal 2
forge build
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

`Deploy.s.sol` uses Anvil's default account 0 and must run on a **fresh** Anvil instance: both backends expect the deterministic contract addresses it produces. The script aborts if the addresses differ.


### 2. Start the supporting services

```bash
docker compose up -d
```

<!-- TODO: list the services docker-compose.yml starts (e.g. ACA-Py agents, IPFS). -->

Expose the ACA-Py agents' DIDComm endpoints through a public tunnel and pass the tunnel URL to ACA-Py with `--endpoint`, otherwise BC Wallet cannot connect.

### 3. Start the backends

Start Anvil and deploy the contracts **before** starting the backends; the verifier backend funds the agent wallet at start-up.

```bash
# Issuer (P1, P3, P5)
cd issuer/backend
pip install fastapi uvicorn httpx web3
export GOV_ID_PEPPER=<random secret>    # optional; otherwise generated into gov_id_pepper.key
uvicorn main:app --port 8002

# Verifier (P2, P4, P6)
cd verifier/backend
uvicorn main:app --port 8012
```

`GOV_ID_PEPPER` is the HMAC key for government-ID commitments. If it is not set, the issuer creates `gov_id_pepper.key` on first run. Keep it secret and never commit it: changing it breaks duplicate detection for existing identities.

### 4. Start the frontends

```bash
cd issuer/frontend   && npm install && npm run dev
cd verifier/frontend && npm install && npm run dev -- -p 3001
```

---

## Walkthrough

1. **P1:** Register a human in the issuer UI (simulated government ID). The DID is anchored in `DIDRegistry`; scan the QR code with BC Wallet to link the wallet.
2. **P3:** Issue a credential. The issuer anchors its status on chain, then delivers it to BC Wallet over DIDComm.
3. **P2:** In the verifier UI, register an agent under the owner's DID. The agent signs the binding and `AgentRegistry` checks the signature.
4. **P4:** Request a proof. BC Wallet answers with a zero-knowledge presentation, and the verifier checks both the proof and the on-chain status.
5. **P6:** Fund the owner's wallet, set a delegation (per-trade limit, total budget, lifetime), and execute trades as the agent. Trades beyond the limit or budget, after expiry or revocation, or by an unregistered agent revert.
6. **P5:** Revoke the credential in the issuer UI; a new P4 run is rejected.

---

## Main API endpoints

| Service | Endpoint | Protocol |
|---------|----------|----------|
| Issuer | `POST /protocol1/create-ssi-identity` | P1 |
| Issuer | `POST /protocol1/connect-wallet`, `POST /protocol1/link-wallet` | P1 |
| Issuer | `POST /protocol3/issue-credential` | P3 |
| Issuer | `POST /protocol5/revoke` | P5 |
| Verifier | `POST /protocol2/register-agent` | P2 |
| Verifier | `POST /protocol4/connect-verifier`, `POST /protocol4/request-proof` | P4 |
| Verifier | `POST /protocol6/fund-wallet`, `POST /protocol6/delegate` | P6 |
| Verifier | `POST /protocol6/execute-trade`, `POST /protocol6/revoke-delegation` | P6 |
| Verifier | `GET /protocol6/inspect/{owner}/{agent_did}`, `GET /protocol6/balances/{agent_did}` | P6 |

---

## Security notes

- The deployment script and backends use Anvil's **public test keys**. Never use them on a real network.
- `/protocol6/execute-trade` is unauthenticated in the prototype; all authorization is enforced by `AgentWallet` on chain.
- Credential presentations reveal the credential identifier for the on-chain status lookup, so presentations of the same credential are linkable across verifiers.
- The model fingerprint is a hash of declared metadata (architecture, version, training-data hash). It is not runtime attestation.

## License

MIT
