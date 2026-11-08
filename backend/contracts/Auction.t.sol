// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { Test } from "forge-std/Test.sol";
import { Auction } from "./Auction.sol";

contract AuctionTest is Test {
    Auction auction;
    address owner = makeAddr("owner"); 
    address seller = makeAddr("seller");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        auction = new Auction(owner, seller, "Quadro", 1 ether, 0.1 ether, 1 days);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_InitialState() public view {
        assertEq(auction.seller(), seller);
        assertEq(auction.owner(), owner); 
        assertEq(uint8(auction.state()), uint8(Auction.State.Open));
        assertEq(auction.highestBid(), 0);
    }

    function test_RevertWhen_ConstructorInvalid() public {
        vm.expectRevert("Seller is zero address");
        new Auction(owner, address(0), "x", 1, 1, 1);
        
        vm.expectRevert("Starting price is zero");
        new Auction(owner, seller, "x", 0, 1, 1);
        
        vm.expectRevert("Increment is zero");
        new Auction(owner, seller, "x", 1, 0, 1);
        
        vm.expectRevert("Duration is zero");
        new Auction(owner, seller, "x", 1, 1, 0);
    }

    function test_FirstBidEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit Auction.NewBid(alice, 1 ether);
        vm.prank(alice);
        auction.bid{value: 1 ether}();
        assertEq(auction.highestBidder(), alice);
        assertEq(auction.highestBid(), 1 ether);
    }

    function test_OutbidCreditsPreviousBidder() public {
        vm.prank(alice);
        auction.bid{value: 1 ether}();
        vm.prank(bob);
        auction.bid{value: 1.1 ether}();
        assertEq(auction.pendingReturns(alice), 1 ether);
        assertEq(auction.highestBidder(), bob);
    }

    function test_RevertWhen_BidTooLow() public {
        vm.prank(alice);
        vm.expectRevert("Bid too low");
        auction.bid{value: 0.5 ether}();
    }

    function test_RevertWhen_SellerBids() public {
        vm.deal(seller, 2 ether);
        vm.prank(seller);
        vm.expectRevert("Seller cannot bid");
        auction.bid{value: 1 ether}();
    }

    function test_RevertWhen_BidAfterExpiry() public {
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vm.expectRevert("Auction expired");
        auction.bid{value: 1 ether}();
    }

    function test_RevertWhen_EndTooEarly() public {
        vm.expectRevert("Auction not expired");
        auction.end();
    }

    function test_EndWithoutBids() public {
        vm.warp(block.timestamp + 1 days);
        auction.end();
        assertEq(auction.pendingReturns(seller), 0);
    }

    function test_FullFlowAndWithdrawals() public {
        vm.prank(alice);
        auction.bid{value: 1 ether}();
        vm.prank(bob);
        auction.bid{value: 2 ether}();
        vm.warp(block.timestamp + 1 days);
        auction.end();

        vm.prank(alice);
        auction.withdraw();
        assertEq(alice.balance, 10 ether);

        vm.prank(seller);
        auction.withdraw();
        assertEq(seller.balance, 2 ether);
    }

    function test_RevertWhen_BidAfterEnded() public {
        vm.warp(block.timestamp + 1 days);
        auction.end();
        vm.prank(alice);
        vm.expectRevert("Invalid state");
        auction.bid{value: 1 ether}();
    }

    function test_RevertWhen_NothingToWithdraw() public {
        vm.prank(alice);
        vm.expectRevert("Nothing to withdraw");
        auction.withdraw();
    }

    function test_RevertWhen_CancelNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(); // Forge si aspetterà il custom error OwnableUnauthorizedAccount(alice)
        auction.cancelAuction();
    }

    function test_CancelAuctionCreditsHighestBidder() public {
        vm.prank(alice);
        auction.bid{value: 1 ether}();
        
        vm.prank(owner);
        auction.cancelAuction();

        assertEq(uint8(auction.state()), uint8(Auction.State.Ended));
        assertEq(auction.pendingReturns(alice), 1 ether); // Alice deve essere rimborsata
    }
}