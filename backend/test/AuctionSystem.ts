import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("AuctionSystem Integration Tests", async function () {
  const { viem, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [owner, seller, alice, bob] = await viem.getWalletClients();

  async function deployFactoryFixture() {
    const factory = await viem.deployContract("AuctionFactory");
    return { factory };
  }

  it("Flusso completo: creazione asta, offerte multiple, rimborso e chiusura naturale", async function () {
    const { factory } = await networkHelpers.loadFixture(deployFactoryFixture);

    // 1. Il seller crea un'asta tramite Factory (verifica emissione AuctionCreated)
    await viem.assertions.emit(
      factory.write.createAuction(
        ["Orologio Vintage", parseEther("1"), parseEther("0.1"), 86400n],
        { account: seller.account }
      ),
      factory,
      "AuctionCreated"
    );

    const count = await factory.read.getAuctionsCount();
    assert.equal(count, 1n);

    const auctionAddress = await factory.read.getAuction([0n]);
    assert.equal(await factory.read.isAuction([auctionAddress]), true);

    const auction = await viem.getContractAt("Auction", auctionAddress);
    assert.equal(await auction.read.item(), "Orologio Vintage");
    assert.equal(getAddress(await auction.read.seller()), getAddress(seller.account.address));
    assert.equal(getAddress(await auction.read.owner()), getAddress(owner.account.address));

    // 2. Alice fa la prima offerta (1 ETH) -> verifica evento NewBid(alice, 1 ETH)
    await viem.assertions.emitWithArgs(
      auction.write.bid({
        value: parseEther("1"),
        account: alice.account,
      }),
      auction,
      "NewBid",
      [getAddress(alice.account.address), parseEther("1")]
    );
    assert.equal(getAddress(await auction.read.highestBidder()), getAddress(alice.account.address));
    assert.equal(await auction.read.highestBid(), parseEther("1"));

    // 3. Bob rilancia (1.5 ETH) -> Alice viene accreditata in pendingReturns
    await auction.write.bid({
      value: parseEther("1.5"),
      account: bob.account,
    });
    assert.equal(getAddress(await auction.read.highestBidder()), getAddress(bob.account.address));
    assert.equal(await auction.read.pendingReturns([alice.account.address]), parseEther("1"));

    // 4. Alice ritira il rimborso -> verifica evento Withdrawal(alice, 1 ETH)
    const aliceBalanceBefore = await publicClient.getBalance({ address: alice.account.address });
    const withdrawAliceHash = await auction.write.withdraw({ account: alice.account });
    const withdrawAliceReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawAliceHash });
    const gasCostAlice = withdrawAliceReceipt.gasUsed * withdrawAliceReceipt.effectiveGasPrice;
    const aliceBalanceAfter = await publicClient.getBalance({ address: alice.account.address });

    assert.equal(aliceBalanceAfter - aliceBalanceBefore + gasCostAlice, parseEther("1"));
    assert.equal(await auction.read.pendingReturns([alice.account.address]), 0n);

    // 5. Avanzamento temporale oltre la scadenza e chiusura asta -> verifica evento AuctionEnded
    await networkHelpers.time.increase(86401);
    await viem.assertions.emitWithArgs(
      auction.write.end({ account: bob.account }),
      auction,
      "AuctionEnded",
      [getAddress(bob.account.address), parseEther("1.5")]
    );

    assert.equal(await auction.read.state(), 1); // State.Ended
    assert.equal(await auction.read.pendingReturns([seller.account.address]), parseEther("1.5"));

    // 6. Il seller incassa il ricavato
    const sellerBalanceBefore = await publicClient.getBalance({ address: seller.account.address });
    const withdrawSellerHash = await auction.write.withdraw({ account: seller.account });
    const withdrawSellerReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawSellerHash });
    const gasCostSeller = withdrawSellerReceipt.gasUsed * withdrawSellerReceipt.effectiveGasPrice;
    const sellerBalanceAfter = await publicClient.getBalance({ address: seller.account.address });

    assert.equal(sellerBalanceAfter - sellerBalanceBefore + gasCostSeller, parseEther("1.5"));
  });

  it("Emergency stop (Pausable) e cancellazione asta da parte dell'owner", async function () {
    const { factory } = await networkHelpers.loadFixture(deployFactoryFixture);

    // Creazione asta
    await factory.write.createAuction(
      ["Laptop", parseEther("2"), parseEther("0.2"), 86400n],
      { account: seller.account }
    );
    const auctionAddress = await factory.read.getAuction([0n]);
    const auction = await viem.getContractAt("Auction", auctionAddress);

    // Alice fa un'offerta
    await auction.write.bid({ value: parseEther("2"), account: alice.account });

    // L'owner mette in pausa la Factory
    await factory.write.pause({ account: owner.account });
    assert.equal(await factory.read.paused(), true);

    // La creazione di nuove aste deve fallire con il custom error EnforcedPause (OpenZeppelin v5)
    await viem.assertions.revertWithCustomError(
      factory.write.createAuction(
        ["Smartphone", parseEther("0.5"), parseEther("0.05"), 86400n],
        { account: seller.account }
      ),
      factory,
      "EnforcedPause"
    );

    // L'owner annulla l'asta in corso -> Alice deve poter prelevare il rimborso
    await auction.write.cancelAuction({ account: owner.account });
    assert.equal(await auction.read.state(), 1); // State.Ended
    assert.equal(await auction.read.pendingReturns([alice.account.address]), parseEther("2"));

    // Riattivazione Factory
    await factory.write.unpause({ account: owner.account });
    assert.equal(await factory.read.paused(), false);
  });

  it("Paginazione aste su Factory con più elementi", async function () {
    const { factory } = await networkHelpers.loadFixture(deployFactoryFixture);

    for (let i = 1; i <= 5; i++) {
      await factory.write.createAuction(
        [`Oggetto ${i}`, parseEther(String(i)), parseEther("0.1"), 86400n],
        { account: seller.account }
      );
    }

    const page = await factory.read.getAuctionsPaginated([1n, 2n]);
    assert.equal(page.length, 2);

    const auction2 = await viem.getContractAt("Auction", page[0]);
    const auction3 = await viem.getContractAt("Auction", page[1]);
    assert.equal(await auction2.read.item(), "Oggetto 2");
    assert.equal(await auction3.read.item(), "Oggetto 3");
  });
});