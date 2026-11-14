// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IDIDRegistry {
    function verifyOwnership(bytes32 _did, address _wallet) external view returns (bool);
}

/**
 * @title AgentRegistry (Protocol 2)
 * @notice Binds an AI agent's identity layers on-chain:
 *         Layer A (modelHash) + Layer C (agentDID, agent key/address) + owner DID.
 * @dev The agent key must sign the binding (proof of possession), so an owner
 *      cannot bind someone else's key, and the agent consents to exactly this
 *      owner and model hash. Matches tPoP / agent_pop in ProVerif P2 and P6.
 */
contract AgentRegistry {
    struct AgentProfile {
        bytes32 agentDID;
        bytes32 ownerDID;
        bytes32 modelHash;
        uint256 registeredAt;
        bool active;
    }

    /// Domain separation tag for the agent's binding signature.
    bytes32 public constant BINDING_TAG = keccak256("DualID.AgentBinding.v1");
    /// secp256k1n / 2: rejects malleable (high-s) signatures.
    uint256 private constant HALF_N =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    IDIDRegistry public immutable didRegistry;

    mapping(bytes32 => AgentProfile) public agents;
    mapping(bytes32 => bytes32[]) public ownerToAgents;
    mapping(address => bytes32) public agentDIDByAddress;   // agent key -> agent DID
    mapping(bytes32 => address) public agentAddressByDID;   // agent DID -> agent key

    event AgentRegistered(bytes32 indexed agentDID, bytes32 indexed ownerDID, bytes32 modelHash);
    event AgentBound(bytes32 indexed agentDID, address indexed agentAddress);
    event AgentDeactivated(bytes32 indexed agentDID);

    constructor(address _didRegistry) {
        didRegistry = IDIDRegistry(_didRegistry);
    }

    /**
     * @param _agentSig 65-byte signature by _agentAddress over
     *        bindingDigest(...) with the standard "\x19Ethereum Signed Message:\n32" prefix.
     */
    function registerAgent(
        bytes32 _agentDID,
        bytes32 _ownerDID,
        bytes32 _modelHash,
        address _agentAddress,
        bytes calldata _agentSig
    ) external {
        // registeredAt (not active) so a deactivated DID can never be re-used
        require(agents[_agentDID].registeredAt == 0, "Agent DID already exists!");
        require(didRegistry.verifyOwnership(_ownerDID, msg.sender), "Caller does not own ownerDID");
        require(_agentAddress != address(0), "Zero agent address");
        require(agentDIDByAddress[_agentAddress] == bytes32(0), "Agent address already bound");
        require(
            _recover(bindingDigest(_agentDID, _ownerDID, _modelHash, _agentAddress), _agentSig) == _agentAddress,
            "Invalid agent signature"
        );

        agents[_agentDID] = AgentProfile({
            agentDID: _agentDID,
            ownerDID: _ownerDID,
            modelHash: _modelHash,
            registeredAt: block.timestamp,
            active: true
        });
        ownerToAgents[_ownerDID].push(_agentDID);
        agentDIDByAddress[_agentAddress] = _agentDID;
        agentAddressByDID[_agentDID] = _agentAddress;

        emit AgentRegistered(_agentDID, _ownerDID, _modelHash);
        emit AgentBound(_agentDID, _agentAddress);
    }

    /// Owner kill switch for the agent identity (independent of delegations).
    function deactivateAgent(bytes32 _agentDID) external {
        AgentProfile storage p = agents[_agentDID];
        require(p.active, "Agent not active");
        require(didRegistry.verifyOwnership(p.ownerDID, msg.sender), "Caller does not own ownerDID");
        p.active = false;
        emit AgentDeactivated(_agentDID);
    }

    /// True iff _agent is a registered, active agent whose owner DID is controlled by _ownerWallet.
    function isAgentOf(address _agent, address _ownerWallet) external view returns (bool) {
        bytes32 d = agentDIDByAddress[_agent];
        if (d == bytes32(0)) return false;
        AgentProfile storage p = agents[d];
        if (!p.active) return false;
        return didRegistry.verifyOwnership(p.ownerDID, _ownerWallet);
    }

    function bindingDigest(
        bytes32 _agentDID,
        bytes32 _ownerDID,
        bytes32 _modelHash,
        address _agentAddress
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(BINDING_TAG, block.chainid, address(this), _agentDID, _ownerDID, _modelHash, _agentAddress)
        );
    }

    /// Unchanged from the original contract (used by /protocol2/verify-link).
    function verifyOwnership(bytes32 _humanDID, bytes32 _agentDID) external view returns (bool) {
        return agents[_agentDID].ownerDID == _humanDID;
    }

    function _recover(bytes32 _digest, bytes calldata _sig) internal pure returns (address) {
        if (_sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(_sig.offset)
            s := calldataload(add(_sig.offset, 32))
            v := byte(0, calldataload(add(_sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        if (uint256(s) > HALF_N) return address(0);
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _digest));
        return ecrecover(ethHash, v, r, s);
    }
}
