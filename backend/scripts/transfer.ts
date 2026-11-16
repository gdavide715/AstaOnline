// SCRIPT DI TEST

import { network } from "hardhat";

async function main() {
  const { viem } = await network.create(); 
  const publicClient = await viem.getPublicClient();
  const [sender, recipient] = await viem.getWalletClients();

  console.log(`Invio di 1 wei da ${sender.account.address} a ${recipient.account.address}...`);

  const hash = await sender.sendTransaction({
    to: recipient.account.address,
    value: 1n,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Trasferimento completato con successo!");
}

main().catch(console.error);