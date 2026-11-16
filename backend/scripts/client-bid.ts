import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import * as fs from "fs";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const customer = walletClients[2];
  const { address: FACTORY_ADDRESS } = JSON.parse(fs.readFileSync("factory-address.json", "utf8"));
  const factory = await viem.getContractAt("AuctionFactory", FACTORY_ADDRESS);

  const allAuctions = await factory.read.getAllAuctions();
  const activeAuctions: `0x${string}`[] = [];

  // 1. Filtra e mostra SOLO le aste aperte (state === 0 -> State.Open)
  for (let i = 0; i < allAuctions.length; i++) {
    const auction = await viem.getContractAt("Auction", allAuctions[i]);
    const state = await auction.read.state(); // 0 = Open, 1 = Ended

    if (state === 0) {
      activeAuctions.push(allAuctions[i]);
      const item = await auction.read.item();
      const highestBid = await auction.read.highestBid();
      const highestBidder = await auction.read.highestBidder();

      console.log(`[${activeAuctions.length - 1}] Indirizzo: ${allAuctions[i]}`);
      console.log(`    Oggetto: ${item}`);
      console.log(`    Offerta massima attuale: ${formatEther(highestBid)} ETH (da ${highestBidder})\n`);
    }
  }

  console.log(`Totale aste aperte visibili: ${activeAuctions.length}\n`);

  // 2. Tentativo di offerta (es. sulla prima asta dell'array totale, anche se chiusa, per testare l'errore)
  if (allAuctions.length === 0) return;
  const targetAuction = await viem.getContractAt("Auction", allAuctions[0]);
  const offerAmount = parseEther("5");

  console.log(`Il cliente tenta di offrire ${formatEther(offerAmount)} ETH su ${allAuctions[0]}...`);

  try {
    const hash = await targetAuction.write.bid({
      value: offerAmount,
      account: customer.account,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Offerta registrata!");
  } catch (error: any) {
    const reason = error?.cause?.reason || error?.shortMessage || "Transazione rifiutata";
    console.log(`Offerta rifiutata dal contratto: ${reason}`); // Restituirà "Invalid state" se chiusa
  }
}

main().catch(console.error);