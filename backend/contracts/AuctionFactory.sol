// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import { Auction } from "./Auction.sol";

// Sistema di gestione aste online.
// Pattern: Factory, Ownable, Emergency Stop (Pausable), Pagination (anti-DoS).
contract AuctionFactory is Ownable, Pausable {
    Auction[] private _auctions;
    mapping(address => bool) public isAuction;

    event AuctionCreated(
        address indexed auctionAddress,
        address indexed seller,
        string item,
        uint256 startingPrice,
        uint256 minIncrement,
        uint256 endTime
    );

    constructor() Ownable(msg.sender) {}

    // Crea una nuova asta (bloccabile dall'owner tramite Emergency Stop)
    function createAuction(
        string calldata item,
        uint256 startingPrice,
        uint256 minIncrement,
        uint256 duration
    ) external whenNotPaused returns (address) {
        require(bytes(item).length > 0, "Item is empty");

        // Creazione sicura tramite 'new':
        // - owner() è l'admin della piattaforma (può chiamare cancelAuction)
        // - msg.sender è il venditore dell'oggetto (seller)
        Auction auction = new Auction(
            owner(),
            msg.sender,
            item,
            startingPrice,
            minIncrement,
            duration
        );

        _auctions.push(auction);
        isAuction[address(auction)] = true;

        emit AuctionCreated(
            address(auction),
            msg.sender,
            item,
            startingPrice,
            minIncrement,
            auction.endTime()
        );

        return address(auction);
    }

    // Emergency Stop Pattern: solo l'owner può mettere in pausa / riattivare la creazione
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getAuctionsCount() external view returns (uint256) {
        return _auctions.length;
    }

    function getAuction(uint256 index) external view returns (Auction) {
        require(index < _auctions.length, "Index out of bounds");
        return _auctions[index];
    }

    function getAllAuctions() external view returns (Auction[] memory) {
        return _auctions;
    }

    // Paginazione per prevenire DoS su array dinamici molto lunghi
    function getAuctionsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (Auction[] memory page) {
        uint256 total = _auctions.length;
        if (offset >= total || limit == 0) {
            return new Auction[](0);
        }

        uint256 size = (offset + limit > total) ? (total - offset) : limit;
        page = new Auction[](size);

        for (uint256 i = 0; i < size; i++) {
            page[i] = _auctions[offset + i];
        }
    }
}