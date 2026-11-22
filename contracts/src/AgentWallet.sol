
// pragma solidity ^0.8.19;

// interface IDelegationRegistry {
//     function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool);
// }

// interface IAgentRegistry {
//     function isAgentOf(address _agent, address _ownerWallet) external view returns (bool);
// }

// contract AgentWallet {
//     address public owner;
//     IDelegationRegistry public registry;
//     IAgentRegistry public agentRegistry;

//     constructor(address _owner, address _registry, address _agentRegistry) {
//         owner = _owner;
//         registry = IDelegationRegistry(_registry);
//         agentRegistry = IAgentRegistry(_agentRegistry);
//     }

//     // Receive funds (to fund the wallet)
//     receive() external payable {}

//     // The Agent calls this function to spend owner's money
//     function executeTrade(address _to, uint256 _amount) external {
//         // Identity: caller must be a registered, active agent bound to this wallet's owner DID
//         require(agentRegistry.isAgentOf(msg.sender, owner), "AGENT NOT REGISTERED");

//         // M3: Enforcement - Ask the Registry "Is this Agent allowed?"
//         bool allowed = registry.checkPermission(owner, msg.sender, _amount);
//         require(allowed, "ACCESS DENIED: Delegation Policy Violation");

//         // Execution
//         (bool success, ) = payable(_to).call{value: _amount}("");
//         require(success, "Transfer failed");
//     }
// }

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IDelegationRegistry {
    function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool);
    function permissions(address _owner, address _agent)
        external view returns (bool active, uint256 spendLimit, uint256 expiry, uint256 budget, uint256 epoch);
}

interface IAgentRegistry {
    function isAgentOf(address _agent, address _ownerWallet) external view returns (bool);
}

contract AgentWallet {
    address public owner;
    IDelegationRegistry public registry;
    IAgentRegistry public agentRegistry;

    // Spent so far per agent and per delegation epoch (only tracked when a budget is set)
    mapping(address => mapping(uint256 => uint256)) public spent;

    constructor(address _owner, address _registry, address _agentRegistry) {
        owner = _owner;
        registry = IDelegationRegistry(_registry);
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    receive() external payable {}

    function executeTrade(address _to, uint256 _amount) external {
        require(agentRegistry.isAgentOf(msg.sender, owner), "AGENT NOT REGISTERED");
        bool allowed = registry.checkPermission(owner, msg.sender, _amount);
        require(allowed, "ACCESS DENIED: Delegation Policy Violation");

        (, , , uint256 budget, uint256 epoch) = registry.permissions(owner, msg.sender);
        if (budget != type(uint256).max) {
            uint256 newSpent = spent[msg.sender][epoch] + _amount;
            require(newSpent <= budget, "ACCESS DENIED: Budget Exhausted");
            spent[msg.sender][epoch] = newSpent;
        }

        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, "Transfer failed");
    }

    /// Remaining total budget of an agent under its current delegation.
    function remainingBudget(address _agent) external view returns (uint256) {
        (, , , uint256 budget, uint256 epoch) = registry.permissions(owner, _agent);
        if (budget == type(uint256).max) return type(uint256).max;
        uint256 s = spent[_agent][epoch];
        return s >= budget ? 0 : budget - s;
    }
}

