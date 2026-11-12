// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DelegationRegistry {
    struct Permission {
        bool active;
        uint256 spendLimit;  // Max wei allowed per transaction
        uint256 expiry;      // Timestamp when permission dies
    }

    // Mapping: Owner -> Agent -> Permission
    mapping(address => mapping(address => Permission)) public permissions;

    event DelegationSet(address indexed owner, address indexed agent, uint256 limit, uint256 expiry);
    event DelegationRevoked(address indexed owner, address indexed agent);
    // M1 & M2: Policy Definition & Authorization
    function setPermission(address _agent, uint256 _limit, uint256 _duration) external {
        permissions[msg.sender][_agent] = Permission({
            active: true,
            spendLimit: _limit,
            expiry: block.timestamp + _duration
        });
        emit DelegationSet(msg.sender, _agent, _limit, block.timestamp + _duration);
    }

    // M3: Enforcement Check
    function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool) {
        Permission memory p = permissions[_owner][_agent];
        if (!p.active) return false;
        if (block.timestamp > p.expiry) return false;
        if (_amount > p.spendLimit) return false;
        return true;
    }
    function revokePermission(address _agent) external {
        require(permissions[msg.sender][_agent].active, "No active delegation");
        permissions[msg.sender][_agent].active = false;
        emit DelegationRevoked(msg.sender, _agent);
    }
}