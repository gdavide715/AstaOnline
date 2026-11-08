// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Importiamo le librerie standard di OpenZeppelin
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { AuctionLib } from "./AuctionLib.sol";

// Asta inglese. Pattern: State Machine, Withdrawal (pull),
// Checks-Effects-Interaction, ReentrancyGuard, Library.
contract Auction is Ownable, ReentrancyGuard {
    enum State { Open, Ended }

    address public immutable seller;
    string public item;
    uint256 public immutable startingPrice;
    uint256 public immutable minIncrement;
    uint256 public immutable endTime;

    State public state;
    address public highestBidder;
    uint256 public highestBid;

    // Withdrawal pattern: ognuno ritira il proprio saldo
    mapping(address => uint256) public pendingReturns;

    event NewBid(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    function _checkState(State s) internal view {
        require(state == s, "Invalid state");
    }

    constructor(
        address initialOwner,
        address seller_,
        string memory item_,
        uint256 startingPrice_,
        uint256 minIncrement_,
        uint256 duration
    ) Ownable(initialOwner) {
        require(seller_ != address(0), "Seller is zero address");
        require(startingPrice_ > 0, "Starting price is zero");
        require(minIncrement_ > 0, "Increment is zero");
        require(duration > 0, "Duration is zero");
        seller = seller_;
        item = item_;
        startingPrice = startingPrice_;
        minIncrement = minIncrement_;
        endTime = block.timestamp + duration;
        state = State.Open;
    }

    function bid() external payable {
        _checkState(State.Open);

        require(block.timestamp < endTime, "Auction expired");
        require(msg.sender != seller, "Seller cannot bid");
        require(
            msg.value >= AuctionLib.minNextBid(highestBid, startingPrice, minIncrement),
            "Bid too low"
        );

        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }
        highestBidder = msg.sender;
        highestBid = msg.value;

        emit NewBid(msg.sender, msg.value);
    }

    // Chiunque può chiudere l'asta dopo la scadenza
    function end() external {
        _checkState(State.Open);

        require(block.timestamp >= endTime, "Auction not expired");

        state = State.Ended;
        if (highestBidder != address(0)) {
            pendingReturns[seller] += highestBid;
        }

        emit AuctionEnded(highestBidder, highestBid);
    }

    // Rimborsi e incasso protetti da ReentrancyGuard di OpenZeppelin
    function withdraw() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw"); // CHECKS

        pendingReturns[msg.sender] = 0; // EFFECTS

        (bool ok, ) = msg.sender.call{value: amount}(""); // INTERACTION
        require(ok, "Transfer failed");

        emit Withdrawal(msg.sender, amount);
    }

    // Utilizzabile solo dall'owner
    function cancelAuction() external onlyOwner {
        _checkState(State.Open);

        state = State.Ended;
        // In caso di annullamento, anche l'offerta attuale diventa rimborsabile
        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }
        emit AuctionEnded(address(0), 0);
    }
}