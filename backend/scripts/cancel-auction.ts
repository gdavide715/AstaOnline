import { network } from "hardhat";
import * as fs from "fs";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner] = await viem.getWalletClients(); // walletClients[0] è l'owner

  const { address: FACTORY_ADDRESS } = JSON.parse(fs.readFileSync("factory-address.json", "utf8"));
  const factory = await viem.getContractAt("AuctionFactory", FACTORY_ADDRESS);

  const auctionAddresses = await factory.read.getAllAuctions();
  const targetIndex = 1; // Indice dell'asta da chiudere

  if (auctionAddresses.length <= targetIndex) {
    console.log("Asta non trovata.");
    return;
  }

  const targetAuction = await viem.getContractAt("Auction", auctionAddresses[targetIndex]);
  console.log(`Chiusura dell'asta [${targetIndex}] (${auctionAddresses[targetIndex]}) da parte dell'owner...`);

  try {
    const hash = await targetAuction.write.cancelAuction({
      account: owner.account,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Asta chiusa con successo (State.Ended).");
  } catch (error: any) {
    const reason = error?.cause?.reason || error?.shortMessage || "Errore sconosciuto";
    console.log(`Impossibile chiudere l'asta: ${reason}`);
  }
}

main().catch(console.error);