const app = require("./app");
const { nodeEnv, port } = require("./config/env");
const { connectToDatabase, disconnectFromDatabase } = require("./lib/db");
const { initializeContractAccess } = require("./lib/contract");

let server;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Shutting down backend gracefully...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await disconnectFromDatabase();
  } catch (error) {
    console.error("Error during backend shutdown", error);
    process.exit(1);
  }

  process.exit(exitCode);
}

async function startServer() {
  const contractAccess = await initializeContractAccess();
  await connectToDatabase();

  server = app.listen(port, () => {
    console.log(`Backend API listening on port ${port} (${nodeEnv})`);
    console.log(
      `Backend signer ${contractAccess.signerAddress} is authorized for contract ${contractAccess.contractAddress} on chain ${contractAccess.chainId}`
    );
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
