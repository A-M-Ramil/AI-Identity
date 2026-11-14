// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IDelegationRegistry {
    function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool);
}

interface IAgentRegistry {
    function isAgentOf(address _agent, address _ownerWallet) external view returns (bool);
}

contract AgentWallet {
    address public owner;
    IDelegationRegistry public registry;
    IAgentRegistry public agentRegistry;

    constructor(address _owner, address _registry, address _agentRegistry) {
        owner = _owner;
        registry = IDelegationRegistry(_registry);
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    // Receive funds (to fund the wallet)
    receive() external payable {}

    // The Agent calls this function to spend owner's money
    function executeTrade(address _to, uint256 _amount) external {
        // Identity: caller must be a registered, active agent bound to this wallet's owner DID
        require(agentRegistry.isAgentOf(msg.sender, owner), "AGENT NOT REGISTERED");

        // M3: Enforcement - Ask the Registry "Is this Agent allowed?"
        bool allowed = registry.checkPermission(owner, msg.sender, _amount);
        require(allowed, "ACCESS DENIED: Delegation Policy Violation");

        // Execution
        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, "Transfer failed");
    }
}
