import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AuctionModule = buildModule("AuctionModule", (m) => {
  // Parametri di esempio passati al costruttore del contratto Auction:
  // owner, seller, item, startingPrice, minIncrement, duration
  const owner = m.getAccount(0);
  const seller = m.getAccount(1);

  const auction = m.contract("Auction", [
    owner,
    seller,
    "Quadro",
    1000000000000000000n, // 1 ETH in wei
    100000000000000000n,  // 0.1 ETH in wei
    86400n                // 1 giorno in secondi
  ]);

  return { auction };
});

export default AuctionModule;