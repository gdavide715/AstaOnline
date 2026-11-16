import { network } from "hardhat";
import { parseEther } from "viem";
import * as fs from "fs";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [, seller] = await viem.getWalletClients();

  const { address: FACTORY_ADDRESS } = JSON.parse(fs.readFileSync("factory-address.json", "utf8"));
  const factory = await viem.getContractAt("AuctionFactory", FACTORY_ADDRESS);

  const hash = await factory.write.createAuction(
    [
      "MacBook Pro",      
      parseEther("2.0"),
      parseEther("0.2"),
      86400n
    ],
    { account: seller.account }
  );

  await publicClient.waitForTransactionReceipt({ hash });

  const count = await factory.read.getAuctionsCount();
  console.log("Nuova asta aggiunta! Totale aste nella Factory:", count);
}

main().catch(console.error);