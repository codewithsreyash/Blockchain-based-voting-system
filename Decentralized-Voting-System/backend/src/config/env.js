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

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/dva";
}

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
}

const nodeEnv = process.env.NODE_ENV || "development";
const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "";
const configuredOrigins = parseOrigins(frontendUrl).map(normalizeOrigin);

const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://blockchain-based-voting-system-weld.vercel.app",
].map(normalizeOrigin);

const allowedCorsOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

function isOriginAllowed(origin) {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const normalized = parsed.origin;
    if (allowedCorsOrigins.includes(normalized)) return true;
    // Allow any Vercel deployment preview / branch URL for this project
    if (parsed.hostname.endsWith(".vercel.app") || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return true;
    }
  } catch {
    // If not a standard URL, fallback to direct string check
    if (allowedCorsOrigins.includes(origin)) return true;
  }
  return false;
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
  isOriginAllowed,
  rpcUrl: process.env.RPC_URL,
  chainId: parseNumber(process.env.CHAIN_ID, 80002),
  contractAddress: process.env.CONTRACT_ADDRESS,
  adminPrivateKey: process.env.ADMIN_PRIVATE_KEY,
  verificationBatchSize: parseNumber(process.env.VERIFICATION_BATCH_SIZE, 50),
  localDemoRpcPort: parseNumber(process.env.LOCAL_DEMO_RPC_PORT, 8545),
  localDemoChainId: parseNumber(process.env.LOCAL_DEMO_CHAIN_ID, 31337),
  localDemoFundingEth: process.env.LOCAL_DEMO_FUNDING_ETH || "1",
};
