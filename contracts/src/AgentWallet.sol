// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IDelegationRegistry {
    function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool);
}

contract AgentWallet {
    address public owner;
    IDelegationRegistry public registry;

    constructor(address _owner, address _registry) {
        owner = _owner;
        registry = IDelegationRegistry(_registry);
    }

    // Receive funds (to fund the wallet)
    receive() external payable {}

    // The Agent calls this function to spend owner's money
    function executeTrade(address _to, uint256 _amount) external {
        // M3: Enforcement - Ask the Registry "Is this Agent allowed?"
        bool allowed = registry.checkPermission(owner, msg.sender, _amount);
        require(allowed, "ACCESS DENIED: Delegation Policy Violation");

        // Execution
        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, "Transfer failed");
    }
}