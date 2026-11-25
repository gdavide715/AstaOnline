import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const AuctionFactoryModule = buildModule("AuctionFactoryModule", (m) => {
  const seller = m.getAccount(1);

  // 1. Deploy della Factory (m.getAccount(0) diventa automaticamente owner/admin)
  const factory = m.contract("AuctionFactory");

  // 2. Creazione di un'asta iniziale di esempio tramite il venditore
  m.call(
    factory,
    "createAuction",
    [
      "Quadro",
      parseEther("1"),   // startingPrice: 1 ETH
      parseEther("0.1"), // minIncrement: 0.1 ETH
      86400n             // duration: 1 giorno (86400 secondi)
    ],
    { from: seller }
  );

  return { factory };
});

export default AuctionFactoryModule;