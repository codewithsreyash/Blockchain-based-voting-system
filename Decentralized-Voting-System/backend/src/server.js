const app = require("./app");
const { nodeEnv, port } = require("./config/env");
const { connectToDatabase, disconnectFromDatabase } = require("./lib/db");
const { getContractContext, initializeContractAccess, shutdownLocalDemoNode, NETWORK_KEYS } = require("./lib/contract");

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
    await shutdownLocalDemoNode();
  } catch (error) {
    console.error("Error during backend shutdown", error);
    process.exit(1);
  }

  process.exit(exitCode);
}

async function startServer() {
  await initializeContractAccess();
  await connectToDatabase();

  server = app.listen(port, () => {
    const amoyAccess = getContractContext(NETWORK_KEYS.AMOY);
    const localDemoAccess = getContractContext(NETWORK_KEYS.LOCAL);
    console.log(`Backend API listening on port ${port} (${nodeEnv})`);
    console.log(
      `Amoy backend signer is authorized for contract ${amoyAccess.contractAddress} on chain ${amoyAccess.chainId}`
    );
    console.log(
      `Demo mode is running on contract ${localDemoAccess.contractAddress} through local RPC ${localDemoAccess.rpcUrl}`
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
