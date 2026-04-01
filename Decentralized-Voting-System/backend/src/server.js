const app = require("./app");
const { port } = require("./config/env");
const { connectToDatabase } = require("./lib/db");
const { initializeContractAccess } = require("./lib/contract");

async function startServer() {
  const contractAccess = await initializeContractAccess();
  await connectToDatabase();

  app.listen(port, () => {
    console.log(`Backend API listening on http://localhost:${port}`);
    console.log(
      `Backend signer ${contractAccess.signerAddress} is authorized for contract ${contractAccess.contractAddress} on chain ${contractAccess.chainId}`
    );
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
