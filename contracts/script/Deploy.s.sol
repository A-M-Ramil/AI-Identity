// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/DIDRegistry.sol";
import "../src/CredentialRegistry.sol";
import "../src/AgentRegistry.sol";
import "../src/DelegationRegistry.sol";
import "../src/AgentWallet.sol";

/**
 * Deploys all five contracts in the order that reproduces the addresses
 * hard-coded in both backends (Anvil account 0, nonces 0..4).
 * Run on a FRESH anvil:
 *   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 */
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        DIDRegistry didRegistry = new DIDRegistry();                                   // nonce 0
        CredentialRegistry credentialRegistry = new CredentialRegistry();              // nonce 1 (issuer = deployer)
        AgentRegistry agentRegistry = new AgentRegistry(address(didRegistry));         // nonce 2
        DelegationRegistry delegationRegistry = new DelegationRegistry();              // nonce 3
        AgentWallet agentWallet =
            new AgentWallet(deployer, address(delegationRegistry), address(agentRegistry)); // nonce 4
        vm.stopBroadcast();

        console.log("DIDRegistry        :", address(didRegistry));
        console.log("CredentialRegistry :", address(credentialRegistry));
        console.log("AgentRegistry      :", address(agentRegistry));
        console.log("DelegationRegistry :", address(delegationRegistry));
        console.log("AgentWallet        :", address(agentWallet));

        require(address(didRegistry) == 0x5FbDB2315678afecb367f032d93F642f64180aa3, "Not a fresh anvil: addresses differ from main.py");
        require(address(agentWallet) == 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9, "Not a fresh anvil: addresses differ from main.py");
    }
}
