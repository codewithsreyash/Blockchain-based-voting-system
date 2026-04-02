const path = require("path");
const dotenv = require("dotenv");
const HDWalletProvider = require("@truffle/hdwallet-provider");

dotenv.config({ path: path.resolve(__dirname, "backend/.env") });

function buildWalletProvider(rpcUrl, privateKey) {
  const normalizedPrivateKey =
    privateKey && !privateKey.startsWith("0x") ? `0x${privateKey}` : privateKey;

  if (!rpcUrl) {
    throw new Error("Missing POLYGON_AMOY_RPC_URL or RPC_URL for the polygonAmoy deployment network.");
  }

  if (!normalizedPrivateKey) {
    throw new Error("Missing ADMIN_PRIVATE_KEY for the polygonAmoy deployment network.");
  }

  return () =>
    new HDWalletProvider({
      privateKeys: [normalizedPrivateKey],
      providerOrUrl: rpcUrl,
    });
}

const polygonAmoyRpcUrl = process.env.POLYGON_AMOY_RPC_URL || process.env.RPC_URL;
const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
    },
    ...(polygonAmoyRpcUrl && adminPrivateKey
      ? {
          polygonAmoy: {
            provider: buildWalletProvider(polygonAmoyRpcUrl, adminPrivateKey),
            network_id: 80002,
            chain_id: 80002,
            confirmations: 2,
            timeoutBlocks: 200,
            networkCheckTimeout: 100000,
            skipDryRun: true,
          },
        }
      : {}),
  },
  compilers: {
    solc: {
      version: "0.8.24",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: "paris",
      },
    },
  },
};
