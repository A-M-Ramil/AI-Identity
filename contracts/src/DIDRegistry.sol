
// pragma solidity ^0.8.19;

// /**
//  * @title DIDRegistry
//  * @notice Implements Protocol 1 (Human) & Protocol 2 (AI Agent)
//  * @dev Maps DIDs to IPFS docs and links AI Agents to Human DIDs.
//  */
// contract DIDRegistry {

//     // --- PROTOCOL 1: HUMAN IDENTITY ---
//     struct DIDRecord {
//         address owner;          // The Ethereum account (Alice)
//         bytes32 ipfsCID;        // Privacy-preserving pointer to data
//         bytes32 govIDHash;      // Anti-Sybil check
//         uint256 registrationTime;
//         bool active;
//     }

//     // --- PROTOCOL 2: AI AGENT IDENTITY ---
//     struct AgentRecord {
//         address humanOwner;     // Link to Alice
//         bytes32 modelHash;      // Hash of the AI Model (Code Integrity)
//         uint256 registeredAt;
//         bool active;
//     }

//     // Mappings
//     mapping(bytes32 => DIDRecord) public didRecords;
//     mapping(bytes32 => bool) public usedGovIDs;
    
//     // New Mapping for Protocol 2: Agent Address -> Agent Record
//     mapping(address => AgentRecord) public agentRecords;

//     // Events
//     event DIDRegistered(bytes32 indexed did, address indexed owner, bytes32 ipfsCID);
//     event AgentRegistered(address indexed agent, address indexed humanOwner, bytes32 modelHash);

//     // Errors
//     error DIDAlreadyExists();
//     error GovIDAlreadyUsed();
//     error Unauthorized();
//     error AgentAlreadyRegistered();

//     // --- FUNCTIONS ---

//     /**
//      * @notice Protocol 1: Registers a Human Identity
//      */
//     function registerDID(bytes32 _did, bytes32 _ipfsCID, bytes32 _govIDHash) external {
//         if (didRecords[_did].active) revert DIDAlreadyExists();
//         if (usedGovIDs[_govIDHash]) revert GovIDAlreadyUsed();

//         didRecords[_did] = DIDRecord({
//             owner: msg.sender,
//             ipfsCID: _ipfsCID,
//             govIDHash: _govIDHash,
//             registrationTime: block.timestamp,
//             active: true
//         });

//         usedGovIDs[_govIDHash] = true;
//         emit DIDRegistered(_did, msg.sender, _ipfsCID);
//     }

//     /**
//      * [cite_start]@notice Protocol 2: Registers an AI Agent [cite: 76]
//      * @dev Only a user with a valid DID can register an Agent.
//      * @param _ownerDID The Human's DID (must match msg.sender)
//      * @param _agentAddress The wallet address of the AI (Agent X)
//      * @param _modelHash SHA256 hash of the Python script/model (Integrity Check)
//      */
//     function registerAgent(bytes32 _ownerDID, address _agentAddress, bytes32 _modelHash) external {
//         // 1. Check if Caller owns the DID
//         if (didRecords[_ownerDID].owner != msg.sender) revert Unauthorized();
//         if (!didRecords[_ownerDID].active) revert Unauthorized();

//         // 2. Check if Agent is already registered
//         if (agentRecords[_agentAddress].active) revert AgentAlreadyRegistered();

//         // 3. Register the Agent
//         agentRecords[_agentAddress] = AgentRecord({
//             humanOwner: msg.sender,
//             modelHash: _modelHash,
//             registeredAt: block.timestamp,
//             active: true
//         });

//         emit AgentRegistered(_agentAddress, msg.sender, _modelHash);
//     }

//     /**
//      * @notice Helper: Checks if an Agent is valid and returns the Owner
//      */
//     function getAgentStatus(address _agent) external view returns (bool isActive, address owner, bytes32 modelHash) {
//         AgentRecord memory agent = agentRecords[_agent];
//         return (agent.active, agent.humanOwner, agent.modelHash);
//     }

//     function verifyOwnership(bytes32 _did, address _wallet) external view returns (bool) {
//         return didRecords[_did].owner == _wallet && didRecords[_did].active;
//     }
// }

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DIDRegistry
 * @notice Implements Protocol 1 (Human) & Protocol 2 (AI Agent)
 * @dev Maps DIDs to IPFS docs and links AI Agents to Human DIDs.
 */
contract DIDRegistry {

    // --- PROTOCOL 1: HUMAN IDENTITY ---
    struct DIDRecord {
        address owner;          // The Ethereum account (Alice)
        bytes32 ipfsCID;        // Privacy-preserving pointer to data
        bytes32 govIDHash;      // Anti-Sybil check
        uint256 registrationTime;
        bool active;
    }

    // --- PROTOCOL 2: AI AGENT IDENTITY ---
    struct AgentRecord {
        address humanOwner;     // Link to Alice
        bytes32 modelHash;      // Hash of the AI Model (Code Integrity)
        uint256 registeredAt;
        bool active;
    }

    // The identity registration module (IRM) account. Only it may anchor
    // human DIDs, so every on-chain DID has passed the IRM's gov-ID check.
    address public immutable registrar;

    constructor() {
        registrar = msg.sender;
    }

    // Mappings
    mapping(bytes32 => DIDRecord) public didRecords;
    mapping(bytes32 => bool) public usedGovIDs;
    
    // New Mapping for Protocol 2: Agent Address -> Agent Record
    mapping(address => AgentRecord) public agentRecords;

    // Events
    event DIDRegistered(bytes32 indexed did, address indexed owner, bytes32 ipfsCID);
    event AgentRegistered(address indexed agent, address indexed humanOwner, bytes32 modelHash);

    // Errors
    error DIDAlreadyExists();
    error GovIDAlreadyUsed();
    error Unauthorized();
    error AgentAlreadyRegistered();

    // --- FUNCTIONS ---

    /**
     * @notice Protocol 1: Registers a Human Identity
     */
    function registerDID(bytes32 _did, bytes32 _ipfsCID, bytes32 _govIDHash) external {
        if (msg.sender != registrar) revert Unauthorized();
        if (didRecords[_did].active) revert DIDAlreadyExists();
        if (usedGovIDs[_govIDHash]) revert GovIDAlreadyUsed();

        didRecords[_did] = DIDRecord({
            owner: msg.sender,
            ipfsCID: _ipfsCID,
            govIDHash: _govIDHash,
            registrationTime: block.timestamp,
            active: true
        });

        usedGovIDs[_govIDHash] = true;
        emit DIDRegistered(_did, msg.sender, _ipfsCID);
    }

    /**
     * [cite_start]@notice Protocol 2: Registers an AI Agent [cite: 76]
     * @dev Only a user with a valid DID can register an Agent.
     * @param _ownerDID The Human's DID (must match msg.sender)
     * @param _agentAddress The wallet address of the AI (Agent X)
     * @param _modelHash SHA256 hash of the Python script/model (Integrity Check)
     */
    function registerAgent(bytes32 _ownerDID, address _agentAddress, bytes32 _modelHash) external {
        // 1. Check if Caller owns the DID
        if (didRecords[_ownerDID].owner != msg.sender) revert Unauthorized();
        if (!didRecords[_ownerDID].active) revert Unauthorized();

        // 2. Check if Agent is already registered
        if (agentRecords[_agentAddress].active) revert AgentAlreadyRegistered();

        // 3. Register the Agent
        agentRecords[_agentAddress] = AgentRecord({
            humanOwner: msg.sender,
            modelHash: _modelHash,
            registeredAt: block.timestamp,
            active: true
        });

        emit AgentRegistered(_agentAddress, msg.sender, _modelHash);
    }

    /**
     * @notice Helper: Checks if an Agent is valid and returns the Owner
     */
    function getAgentStatus(address _agent) external view returns (bool isActive, address owner, bytes32 modelHash) {
        AgentRecord memory agent = agentRecords[_agent];
        return (agent.active, agent.humanOwner, agent.modelHash);
    }

    function verifyOwnership(bytes32 _did, address _wallet) external view returns (bool) {
        return didRecords[_did].owner == _wallet && didRecords[_did].active;
    }
}