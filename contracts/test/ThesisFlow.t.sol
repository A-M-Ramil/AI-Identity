// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../lib/forge-std/src/Test.sol";
import "../src/DelegationRegistry.sol";
import "../src/AgentWallet.sol";

contract ThesisFlowTest is Test {
    DelegationRegistry registry;
    AgentWallet wallet;

    // FIXED: Use makeAddr to generate valid addresses
    address alice = makeAddr("alice");
    address agentX = makeAddr("agentX");
    address vendor = makeAddr("vendor");

    function setUp() public {
        // 1. Deploy Registry
        registry = new DelegationRegistry();

        // 2. Alice deploys her wallet, pointing to the Registry
        vm.startPrank(alice);
        wallet = new AgentWallet(address(registry));
        vm.stopPrank();

        // 3. Fund Alice's AgentWallet with 10 ETH
        vm.deal(address(wallet), 10 ether);
    }

    function test_DemoStory_TimeBasedDelegation() public {
        // --- SCENE 1: Delegation ---
        // Alice delegates to Agent X: Valid for 5 minutes (300 seconds), Max 1 ETH
        vm.prank(alice);
        registry.setDelegation(agentX, 300, 1 ether);

        // --- SCENE 2: Success ---
        // Agent X tries to send 0.5 ETH immediately
        vm.prank(agentX);
        wallet.executeTrade(payable(vendor), 0.5 ether);

        // Verify vendor got the money
        assertEq(vendor.balance, 0.5 ether);

        // --- SCENE 3: Time Passes ---
        // Fast forward time by 6 minutes (360 seconds)
        vm.warp(block.timestamp + 360);

        // --- SCENE 4: Failure ---
        // Agent X tries to trade again. Should Fail because time expired.
        vm.startPrank(agentX);
        vm.expectRevert(DelegationRegistry.Unauthorized.selector);
        wallet.executeTrade(payable(vendor), 0.1 ether);
        vm.stopPrank();
    }
}