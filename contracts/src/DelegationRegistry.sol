
// pragma solidity ^0.8.19;

// contract DelegationRegistry {
//     struct Permission {
//         bool active;
//         uint256 spendLimit;  // Max wei allowed per transaction
//         uint256 expiry;      // Timestamp when permission dies
//     }

//     // Mapping: Owner -> Agent -> Permission
//     mapping(address => mapping(address => Permission)) public permissions;

//     event DelegationSet(address indexed owner, address indexed agent, uint256 limit, uint256 expiry);
//     event DelegationRevoked(address indexed owner, address indexed agent);
//     // M1 & M2: Policy Definition & Authorization
//     function setPermission(address _agent, uint256 _limit, uint256 _duration) external {
//         permissions[msg.sender][_agent] = Permission({
//             active: true,
//             spendLimit: _limit,
//             expiry: block.timestamp + _duration
//         });
//         emit DelegationSet(msg.sender, _agent, _limit, block.timestamp + _duration);
//     }

//     // M3: Enforcement Check
//     function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool) {
//         Permission memory p = permissions[_owner][_agent];
//         if (!p.active) return false;
//         if (block.timestamp > p.expiry) return false;
//         if (_amount > p.spendLimit) return false;
//         return true;
//     }
//     function revokePermission(address _agent) external {
//         require(permissions[msg.sender][_agent].active, "No active delegation");
//         permissions[msg.sender][_agent].active = false;
//         emit DelegationRevoked(msg.sender, _agent);
//     }
// }

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DelegationRegistry {
    struct Permission {
        bool active;
        uint256 spendLimit;  // Max wei allowed per transaction
        uint256 expiry;      // Timestamp when permission dies
        uint256 budget;      // Max wei in total for this delegation (type(uint256).max = no total cap)
        uint256 epoch;       // Bumped on every set/revoke, so a new delegation starts with nothing spent
    }

    uint256 public constant NO_BUDGET = type(uint256).max;

    mapping(address => mapping(address => Permission)) public permissions;

    event DelegationSet(address indexed owner, address indexed agent, uint256 limit, uint256 expiry);
    event DelegationBudgetSet(address indexed owner, address indexed agent, uint256 budget, uint256 epoch);
    event DelegationRevoked(address indexed owner, address indexed agent);

    /// Per-transaction limit only (no total cap). Kept for backward compatibility.
    function setPermission(address _agent, uint256 _limit, uint256 _duration) external {
        _set(_agent, _limit, NO_BUDGET, _duration);
    }

    /// Per-transaction limit plus a total budget across all trades of this delegation.
    function setPermissionWithBudget(address _agent, uint256 _limit, uint256 _budget, uint256 _duration) external {
        _set(_agent, _limit, _budget, _duration);
    }

    function _set(address _agent, uint256 _limit, uint256 _budget, uint256 _duration) internal {
        Permission storage p = permissions[msg.sender][_agent];
        p.active = true;
        p.spendLimit = _limit;
        p.expiry = block.timestamp + _duration;
        p.budget = _budget;
        p.epoch += 1;
        emit DelegationSet(msg.sender, _agent, _limit, block.timestamp + _duration);
        emit DelegationBudgetSet(msg.sender, _agent, _budget, p.epoch);
    }

    function checkPermission(address _owner, address _agent, uint256 _amount) external view returns (bool) {
        Permission memory p = permissions[_owner][_agent];
        if (!p.active) return false;
        if (block.timestamp > p.expiry) return false;
        if (_amount > p.spendLimit) return false;
        return true;
    }

    function revokePermission(address _agent) external {
        Permission storage p = permissions[msg.sender][_agent];
        require(p.active, "No active delegation");
        p.active = false;
        p.epoch += 1;
        emit DelegationRevoked(msg.sender, _agent);
    }
}
