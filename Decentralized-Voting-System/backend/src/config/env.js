const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function parseNumber(value, fallback) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function parseOrigins(value) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, "");
  }
}

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

const nodeEnv = process.env.NODE_ENV || "development";
const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "";
const allowedCorsOrigins = Array.from(
  new Set([
    ...parseOrigins(frontendUrl).map(normalizeOrigin),
    ...(nodeEnv === "development" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : []).map(normalizeOrigin),
  ])
);

if (nodeEnv === "production" && allowedCorsOrigins.length === 0) {
  throw new Error("Missing FRONTEND_URL environment variable for production CORS configuration.");
}

module.exports = {
  port: parseNumber(process.env.PORT, 4000),
  nodeEnv,
  mongodbUri: process.env.MONGODB_URI,
  mongodbServerSelectionTimeoutMs: parseNumber(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10000),
  mongodbSocketTimeoutMs: parseNumber(process.env.MONGODB_SOCKET_TIMEOUT_MS, 45000),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl,
  allowedCorsOrigins,
  rpcUrl: process.env.RPC_URL,
  chainId: parseNumber(process.env.CHAIN_ID, 80002),
  contractAddress: process.env.CONTRACT_ADDRESS,
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY,
  verificationBatchSize: parseNumber(process.env.VERIFICATION_BATCH_SIZE, 50),
  localDemoRpcPort: parseNumber(process.env.LOCAL_DEMO_RPC_PORT, 8545),
  localDemoChainId: parseNumber(process.env.LOCAL_DEMO_CHAIN_ID, 31337),
  localDemoFundingEth: process.env.LOCAL_DEMO_FUNDING_ETH || "1",
};
