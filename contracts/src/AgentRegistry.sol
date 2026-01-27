// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentRegistry
 * @notice Protocol 2: AI Agent Identity & Ownership
 */
contract AgentRegistry {

    struct AgentProfile {
        bytes32 agentDID;       // The SSI DID (from ACA-Py)
        bytes32 ownerDID;       // The Human Owner's DID
        bytes32 modelHash;      // The AI Model Fingerprint (Step M2)
        uint256 registeredAt;
        bool active;
    }

    // Map: Agent DID Hash -> Profile
    mapping(bytes32 => AgentProfile) public agents;
    
    // Map: Human DID Hash -> List of Agent DIDs (Forward Accountability)
    mapping(bytes32 => bytes32[]) public ownerToAgents;

    event AgentRegistered(bytes32 indexed agentDID, bytes32 indexed ownerDID, bytes32 modelHash);

    function registerAgent(bytes32 _agentDID, bytes32 _ownerDID, bytes32 _modelHash) external {
        // 1. Check if already registered
        require(!agents[_agentDID].active, "Agent DID already exists!");

        // 2. Store the Link
        agents[_agentDID] = AgentProfile({
            agentDID: _agentDID,
            ownerDID: _ownerDID,
            modelHash: _modelHash,
            registeredAt: block.timestamp,
            active: true
        });

        // 3. Update Ownership Record
        ownerToAgents[_ownerDID].push(_agentDID);

        emit AgentRegistered(_agentDID, _ownerDID, _modelHash);
    }

    // Helper to check if a Human owns an Agent
    function verifyOwnership(bytes32 _humanDID, bytes32 _agentDID) external view returns (bool) {
        return agents[_agentDID].ownerDID == _humanDID;
    }
}