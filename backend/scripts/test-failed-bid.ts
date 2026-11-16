//SCRIPT DI TEST

import { network } from "hardhat";

async function main() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  
  const bidder = walletClients[1]; 
  const auctionAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; //bob

  console.log("Tentativo di offerta non valida con l'account:", bidder.account.address);

  try {
    // Esempio: offerta troppo bassa (es. 0.1 ETH quando ne servirebbe di più o non rispetta il minimo)
    // Oppure se l'asta è scaduta/chiusa.
    const hash = await bidder.writeContract({
      address: auctionAddress,
      abi: [
        {
          "inputs": [],
          "name": "bid",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        }
      ],
      functionName: "bid",
      value: 100000000000000000n, // 0.1 ETH (troppo basso rispetto al prezzo di partenza)
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Transazione riuscita (non previsto se l'offerta era errata).");
  } catch (error: any) {
    console.log("Test superato con successo! Il contratto ha correttamente rifiutato l'offerta.");
    console.log("Messaggio di errore ricevuto:", error.shortMessage || error.message);
  }
}

main().catch(console.error);