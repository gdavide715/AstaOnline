Installa librerie:
npm install @openzeppelin/contracts

npx hardhat compile

npx hardhat test solidity
npx hardhat test --coverage

In terminale separato:
npx hardhat node

E poi:
# 1. Deploya la Factory, salva l'indirizzo in JSON e crea la prima asta ("Orologio")
npx hardhat run scripts/run-factory.ts --network localhost

# 2. Aggiunge una seconda asta ("MacBook Pro") alla stessa Factory
npx hardhat run scripts/add-auction.ts --network localhost

# 3. Il cliente visualizza le aste attive e fa un'offerta
npx hardhat run scripts/client-bid.ts --network localhost

# 4. (Opzionale) Fai rifare un'offerta più alta a un altro cliente per testare il rimborso, poi preleva:
npx hardhat run scripts/withdraw.ts --network localhost

# 5. Fa scadere il tempo (24h) e chiude naturalmente l'asta
npx hardhat run scripts/end-auction.ts --network localhost

# 6. Il venditore incassa il ricavato dell'asta conclusa
npx hardhat run scripts/withdraw.ts --network localhost

# 7. L'admin annulla anticipatamente un'asta aperta
npx hardhat run scripts/cancel-auction.ts --network localhost

