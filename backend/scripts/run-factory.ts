import { network } from "hardhat";
import * as fs from "fs";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner, seller] = await viem.getWalletClients();

  // 1. Deploya AuctionFactory (owner diventa l'admin)
  const factory = await viem.deployContract("AuctionFactory");
  fs.writeFileSync("factory-address.json", JSON.stringify({ address: factory.address }, null, 2));

  // 2. Il venditore (seller) crea una nuova asta chiamando createAuction
  const hash = await factory.write.createAuction(
    [
      "Orologio",
      1000000000000000000n, 
      100000000000000000n,  
      86400n                // duration: 1 giorno in secondi
    ],
    { account: seller.account }
  );

  await publicClient.waitForTransactionReceipt({ hash });
  
  // 3. Verifica l'indirizzo della nuova asta creata
  const auctions = await factory.read.getAllAuctions();
  console.log("Asta creata con successo all'indirizzo:", auctions[0]);

  

    const auction = await viem.getContractAt("Auction", auctions[0]);

    console.log("Oggetto:", await auction.read.item());
    console.log("Offerta massima attuale:", await auction.read.highestBid());
    console.log("Venditore:", await auction.read.seller());

}

main().catch(console.error);