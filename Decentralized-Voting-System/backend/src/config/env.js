const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const requiredVariables = [
  "MONGODB_URI",
  "JWT_SECRET",
  "RPC_URL",
  "CONTRACT_ADDRESS",
  "ADMIN_PRIVATE_KEY",
];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl: process.env.FRONTEND_URL || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  rpcUrl: process.env.RPC_URL,
  chainId: Number(process.env.CHAIN_ID || 80002),
  contractAddress: process.env.CONTRACT_ADDRESS,
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY,
  verificationBatchSize: Number(process.env.VERIFICATION_BATCH_SIZE || 50),
};
