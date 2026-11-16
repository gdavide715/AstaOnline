import { network } from "hardhat";
import { formatEther } from "viem";
import * as fs from "fs";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const { address: FACTORY_ADDRESS } = JSON.parse(fs.readFileSync("factory-address.json", "utf8"));
  const factory = await viem.getContractAt("AuctionFactory", FACTORY_ADDRESS);

  const auctions = await factory.read.getAllAuctions();
  if (auctions.length === 0) return;

  const auction = await viem.getContractAt("Auction", auctions[0]);
  const user = walletClients[1]; // Cambia indice (es. walletClients[1] per il seller)

  const pending = await auction.read.pendingReturns([user.account.address]);
  console.log(`Fondi prelevabili per ${user.account.address}: ${formatEther(pending)} ETH`);

  try {
    const hash = await auction.write.withdraw({ account: user.account });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Prelievo completato con successo!");
  } catch (error: any) {
    const reason = error?.cause?.reason || error?.shortMessage || "Errore nel prelievo";
    console.log(`❌ Prelievo rifiutato: ${reason}`);
  }
}

main().catch(console.error);