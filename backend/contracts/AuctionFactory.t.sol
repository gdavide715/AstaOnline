// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { Test } from "forge-std/Test.sol";
import { AuctionFactory } from "./AuctionFactory.sol";
import { Auction } from "./Auction.sol";

contract AuctionFactoryTest is Test {
    AuctionFactory factory;
    address owner = makeAddr("owner");
    address seller = makeAddr("seller");
    address alice = makeAddr("alice");

    function setUp() public {
        vm.prank(owner);
        factory = new AuctionFactory();
        vm.deal(alice, 100 ether);
    }

    function test_InitialState() public view {
        assertEq(factory.owner(), owner);
        assertEq(factory.getAuctionsCount(), 0);
        assertFalse(factory.paused());
    }

    function test_CreateAuctionAndVerifyParameters() public {
        vm.prank(seller);
        address auctionAddr = factory.createAuction("Orologio", 1 ether, 0.1 ether, 1 days);

        assertEq(factory.getAuctionsCount(), 1);
        assertTrue(factory.isAuction(auctionAddr));
        assertEq(address(factory.getAuction(0)), auctionAddr);
        assertEq(factory.getAllAuctions().length, 1);

        Auction auction = Auction(auctionAddr);
        assertEq(auction.owner(), owner);
        assertEq(auction.seller(), seller);
        assertEq(auction.item(), "Orologio");
        assertEq(auction.startingPrice(), 1 ether);
        assertEq(auction.minIncrement(), 0.1 ether);
    }

    function test_RevertWhen_CreateWithEmptyItem() public {
        vm.prank(seller);
        vm.expectRevert("Item is empty");
        factory.createAuction("", 1 ether, 0.1 ether, 1 days);
    }

    function test_RevertWhen_GetAuctionOutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        factory.getAuction(0);
    }

    function test_PauseAndUnpauseByOwner() public {
        vm.prank(owner);
        factory.pause();
        assertTrue(factory.paused());

        // Tentativo di creazione asta mentre il contratto è in pausa
        vm.prank(seller);
        vm.expectRevert();
        factory.createAuction("Moneta", 1 ether, 0.1 ether, 1 days);

        vm.prank(owner);
        factory.unpause();
        assertFalse(factory.paused());

        vm.prank(seller);
        factory.createAuction("Moneta", 1 ether, 0.1 ether, 1 days);
        assertEq(factory.getAuctionsCount(), 1);
    }

    function test_RevertWhen_NonOwnerPausesOrUnpauses() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.pause();

        vm.prank(owner);
        factory.pause();

        vm.prank(alice);
        vm.expectRevert();
        factory.unpause();
    }

    function test_Pagination() public {
        vm.startPrank(seller);
        factory.createAuction("Asta 1", 1 ether, 0.1 ether, 1 days);
        factory.createAuction("Asta 2", 2 ether, 0.1 ether, 1 days);
        factory.createAuction("Asta 3", 3 ether, 0.1 ether, 1 days);
        vm.stopPrank();

        // Pagina valida (offset 1, limit 2 -> restituisce Asta 2 e Asta 3)
        Auction[] memory page = factory.getAuctionsPaginated(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].startingPrice(), 2 ether);
        assertEq(page[1].startingPrice(), 3 ether);

        // Limit che eccede il totale disponibile (offset 2, limit 10 -> restituisce solo Asta 3)
        Auction[] memory partialPage = factory.getAuctionsPaginated(2, 10);
        assertEq(partialPage.length, 1);
        assertEq(partialPage[0].startingPrice(), 3 ether);

        // Offset fuori range o limit 0 -> array vuoto
        assertEq(factory.getAuctionsPaginated(5, 2).length, 0);
        assertEq(factory.getAuctionsPaginated(0, 0).length, 0);
    }

    // Fuzz Test: verifica creazione e prima offerta con valori random
    function testFuzz_CreateAndBid(uint96 startPrice, uint96 increment, uint32 duration) public {
        vm.assume(startPrice > 0 && startPrice <= 50 ether);
        vm.assume(increment > 0 && increment <= 10 ether);
        vm.assume(duration > 0 && duration <= 365 days);

        vm.prank(seller);
        address auctionAddr = factory.createAuction("FuzzItem", startPrice, increment, duration);
        Auction auction = Auction(auctionAddr);

        vm.prank(alice);
        auction.bid{value: startPrice}();

        assertEq(auction.highestBidder(), alice);
        assertEq(auction.highestBid(), startPrice);
    }
}