// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/DelegationRegistry.sol";
import "../src/DIDRegistry.sol";  // Added import

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Delegation Registry (Protocol 6)
        DelegationRegistry delegationRegistry = new DelegationRegistry();

        // 2. Deploy DID Registry (Protocol 1)
        DIDRegistry didRegistry = new DIDRegistry();

        vm.stopBroadcast();
        
        console.log("--------------------------------------------------");
        console.log("DelegationRegistry Deployed At:", address(delegationRegistry));
        console.log("DIDRegistry Deployed At:       ", address(didRegistry));
        console.log("--------------------------------------------------");
    }
}