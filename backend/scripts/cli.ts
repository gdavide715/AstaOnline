import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import * as fs from "fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const wallets = await viem.getWalletClients();

  const { address: FACTORY_ADDRESS } = JSON.parse(fs.readFileSync("factory-address.json", "utf8"));
  const factory = await viem.getContractAt("AuctionFactory", FACTORY_ADDRESS);

  const rl = readline.createInterface({ input, output });

  // Funzione helper per mostrare i saldi reali degli utenti (e opzionalmente del contratto asta)
  async function printBalances(auctionAddress?: `0x${string}`) {
    console.log("\n --- SALDI ATTUALI (ETH) ---");
    const labels = ["Admin (0)", "Venditore (1)", "Cliente A (2)", "Cliente B (3)"];
    for (let i = 0; i < 4; i++) {
      const bal = await publicClient.getBalance({ address: wallets[i].account.address });
      console.log(`   ${labels[i]}: ${Number(formatEther(bal)).toFixed(4)} ETH`);
    }
    if (auctionAddress) {
      const contractBal = await publicClient.getBalance({ address: auctionAddress });
      console.log(`   Contratto Asta : ${Number(formatEther(contractBal)).toFixed(4)} ETH (fondi bloccati)`);
    }
    console.log("------------------------------");
  }

  console.log("\n=== BENVENUTO NELLA CLI DELLE ASTE ===");
  await printBalances();

  console.log("\nSeleziona con quale account vuoi operare:");
  console.log(`[0] Admin / Owner (${wallets[0].account.address})`);
  console.log(`[1] Venditore     (${wallets[1].account.address})`);
  console.log(`[2] Cliente A     (${wallets[2].account.address})`);
  console.log(`[3] Cliente B     (${wallets[3].account.address})`);

  const roleIdx = Number(await rl.question("\nInserisci il numero dell'account: "));
  const currentUser = wallets[roleIdx] || wallets[2];
  console.log(`Connesso come: ${currentUser.account.address}\n`);

  let running = true;

  while (running) {
    console.log("\n--- MENU PRINCIPALE ---");
    console.log("1. Visualizza aste aperte");
    console.log("2. Fai un'offerta su un'asta");
    console.log("3. Termina un'asta (Venditore)");
    console.log("4. Preleva fondi / rimborsi (Withdraw)");
    console.log("5. Mostra saldi wallet");
    console.log("0. Esci");

    const choice = await rl.question("\nScegli un'opzione: ");

    switch (choice.trim()) {
      case "1": {
        const allAuctions = await factory.read.getAllAuctions();
        console.log("\n--- ASTE APERTE ---");
        let openCount = 0;

        for (let i = 0; i < allAuctions.length; i++) {
          const auction = await viem.getContractAt("Auction", allAuctions[i]);
          const state = await auction.read.state();

          if (state === 0) {
            openCount++;
            const item = await auction.read.item();
            const highestBid = await auction.read.highestBid();
            const seller = await auction.read.seller();
            console.log(`[ID ${i}] ${item} (${allAuctions[i]})`);
            console.log(`        Offerta attuale: ${formatEther(highestBid)} ETH | Venditore: ${seller}`);
          }
        }
        if (openCount === 0) console.log("Nessuna asta aperta al momento.");
        break;
      }

      case "2": {
        const allAuctions = await factory.read.getAllAuctions();
        const id = Number(await rl.question("Inserisci l'ID dell'asta su cui offrire: "));
        if (!allAuctions[id]) {
          console.log("ID asta non valido.");
          break;
        }

        const amountStr = await rl.question("Inserisci l'importo dell'offerta in ETH (es. 2.5): ");
        const targetAuction = await viem.getContractAt("Auction", allAuctions[id]);

        try {
          const hash = await targetAuction.write.bid({
            value: parseEther(amountStr),
            account: currentUser.account,
          });
          await publicClient.waitForTransactionReceipt({ hash });
          console.log(`Offerta di ${amountStr} ETH registrata!`);
          await printBalances(allAuctions[id]);
        } catch (error: any) {
          const reason = error?.cause?.reason || error?.shortMessage || "Errore transazione";
          console.log(`Offerta rifiutata: ${reason}`);
        }
        break;
      }

      case "3": {
        const allAuctions = await factory.read.getAllAuctions();
        const id = Number(await rl.question("Inserisci l'ID dell'asta da terminare: "));
        if (!allAuctions[id]) {
          console.log("ID asta non valido.");
          break;
        }

        const targetAuction = await viem.getContractAt("Auction", allAuctions[id]);
        const seller = await targetAuction.read.seller();

        if (seller.toLowerCase() !== currentUser.account.address.toLowerCase()) {
          console.log("Non sei il venditore di questa asta!");
          break;
        }

        try {
          console.log("Avanzamento tempo blockchain e chiusura asta...");
          await testClient.increaseTime({ seconds: 86401 });
          await testClient.mine({ blocks: 1 });

          const hash = await targetAuction.write.end({ account: currentUser.account });
          await publicClient.waitForTransactionReceipt({ hash });
          console.log("Asta terminata! I fondi sono ora prelevabili dal venditore (opzione 4).");
          await printBalances(allAuctions[id]);
        } catch (error: any) {
          const reason = error?.cause?.reason || error?.shortMessage || "Errore chiusura";
          console.log(`Impossibile terminare l'asta: ${reason}`);
        }
        break;
      }

      case "4": {
        const allAuctions = await factory.read.getAllAuctions();
        const id = Number(await rl.question("Inserisci l'ID dell'asta da cui prelevare: "));
        if (!allAuctions[id]) {
          console.log("ID asta non valido.");
          break;
        }

        const targetAuction = await viem.getContractAt("Auction", allAuctions[id]);
        try {
          const hash = await targetAuction.write.withdraw({ account: currentUser.account });
          await publicClient.waitForTransactionReceipt({ hash });
          console.log("Fondi prelevati sul tuo wallet!");
          await printBalances(allAuctions[id]);
        } catch (error: any) {
          const reason = error?.cause?.reason || error?.shortMessage || "Nessun fondo disponibile";
          console.log(`Prelievo rifiutato: ${reason}`);
        }
        break;
      }

      case "5":
        await printBalances();
        break;

      case "0":
        running = false;
        break;

      default:
        console.log("Scelta non valida.");
    }
  }

  rl.close();
}

main().catch(console.error);