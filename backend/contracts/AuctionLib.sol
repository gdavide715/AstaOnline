// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Pattern Library (slide 5.5): funzioni pure/internal, nessuno storage.
library AuctionLib {
    // Offerta minima accettabile: prezzo base se nessuno ha offerto,
    // altrimenti miglior offerta + incremento minimo.
    function minNextBid(
        uint256 highestBid,
        uint256 startingPrice,
        uint256 minIncrement
    ) internal pure returns (uint256) {
        if (highestBid == 0) {
            return startingPrice;
        }
        return highestBid + minIncrement;
    }
}
