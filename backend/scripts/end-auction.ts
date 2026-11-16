import { network } from "hardhat";
import { formatEther } from "viem";
import * as fs from "fs";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const [caller] = await viem.getWalletClients();

  const { address: FACTORY_ADDRESS } = JSON.parse(fs.readFileSync("factory-address.json", "utf8"));
  const factory = await viem.getContractAt("AuctionFactory", FACTORY_ADDRESS);

  const auctions = await factory.read.getAllAuctions();
  if (auctions.length === 0) return;

  const auction = await viem.getContractAt("Auction", auctions[0]);

  console.log("Avanzamento tempo sulla blockchain locale di 24 ore...");
  await testClient.increaseTime({ seconds: 86401 });
  await testClient.mine({ blocks: 1 });

  try {
    const hash = await auction.write.end({ account: caller.account });
    await publicClient.waitForTransactionReceipt({ hash });

    const winner = await auction.read.highestBidder();
    const finalPrice = await auction.read.highestBid();
    console.log(`✅ Asta conclusa! Vincitore: ${winner} per ${formatEther(finalPrice)} ETH`);
  } catch (error: any) {
    const reason = error?.cause?.reason || error?.shortMessage || "Errore nella chiusura";
    console.log(`❌ Impossibile chiudere l'asta: ${reason}`);
  }
}

main().catch(console.error);