// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IDIDRegistry {
    function verifyOwnership(bytes32 _did, address _wallet) external view returns (bool);
}

contract AgentRegistry {
    struct AgentProfile {
        bytes32 agentDID;
        bytes32 ownerDID;
        bytes32 modelHash;
        uint256 registeredAt;
        bool active;
    }

    IDIDRegistry public immutable didRegistry;

    mapping(bytes32 => AgentProfile) public agents;
    mapping(bytes32 => bytes32[]) public ownerToAgents;

    event AgentRegistered(bytes32 indexed agentDID, bytes32 indexed ownerDID, bytes32 modelHash);

    constructor(address _didRegistry) {
        didRegistry = IDIDRegistry(_didRegistry);
    }

    function registerAgent(
        bytes32 _agentDID,
        bytes32 _ownerDID,
        bytes32 _modelHash
    ) external {
        require(!agents[_agentDID].active, "Agent DID already exists!");
        require(didRegistry.verifyOwnership(_ownerDID, msg.sender), "Caller does not own ownerDID");

        agents[_agentDID] = AgentProfile({
            agentDID: _agentDID,
            ownerDID: _ownerDID,
            modelHash: _modelHash,
            registeredAt: block.timestamp,
            active: true
        });

        ownerToAgents[_ownerDID].push(_agentDID);
        emit AgentRegistered(_agentDID, _ownerDID, _modelHash);
    }

    function verifyOwnership(bytes32 _humanDID, bytes32 _agentDID) external view returns (bool) {
        return agents[_agentDID].ownerDID == _humanDID;
    }
}