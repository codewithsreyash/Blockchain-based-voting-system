const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore if custom dns servers cannot be configured
}

const mongoose = require("mongoose");
const {
  mongodbUri,
  mongodbServerSelectionTimeoutMs,
  mongodbSocketTimeoutMs,
} = require("../config/env");
const { ensureElectionIndexes } = require("../models/Election");

async function ensureDefaultAdmin() {
  try {
    const User = require("../models/User");
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount === 0) {
      const bcrypt = require("bcryptjs");
      const seedEmail = (process.env.ADMIN_SEED_EMAIL || "admin@gmail.com").toLowerCase();
      const seedPassword = process.env.ADMIN_SEED_PASSWORD || "admin123";
      const seedName = process.env.ADMIN_SEED_NAME || "Election Commissioner";
      const passwordHash = await bcrypt.hash(seedPassword, 12);
      await User.create({
        fullName: seedName,
        email: seedEmail,
        passwordHash,
        role: "admin",
        verificationStatus: "verified",
        walletAddress: "0xF2fCc12dc899e4Af03E79Fa467f77De073ed58cd",
      });
      console.log(`Auto-seeded initial admin user for ${seedEmail}`);
    }
  } catch (err) {
    console.warn("Notice: could not auto-seed admin user:", err.message);
  }
}

let listenersRegistered = false;
let connectionPromise = null;

function registerConnectionListeners() {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected. Waiting for the driver to reconnect...");
  });
  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error", error);
  });
}

async function attemptConnect(uri, timeoutMs = 8000) {
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    socketTimeoutMS: mongodbSocketTimeoutMs,
  });
}

const LOCAL_FALLBACK_URI = "mongodb://127.0.0.1:27017/dva";

async function connectToDatabase() {
  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);
  registerConnectionListeners();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      console.log(`Connecting to primary MongoDB URI...`);
      await attemptConnect(mongodbUri, mongodbServerSelectionTimeoutMs);
      console.log("Primary MongoDB connected successfully");
    } catch (primaryError) {
      console.warn(`Primary MongoDB connection failed: ${primaryError.message}`);

      // If primary failed and isn't the local URI, attempt local fallback
      if (mongodbUri !== LOCAL_FALLBACK_URI) {
        try {
          console.log(`Attempting fallback connection to local MongoDB (${LOCAL_FALLBACK_URI})...`);
          await attemptConnect(LOCAL_FALLBACK_URI, 3000);
          console.log("Connected to fallback local MongoDB");
        } catch (fallbackError) {
          console.warn(`Fallback local MongoDB also unavailable: ${fallbackError.message}`);
          throw primaryError;
        }
      } else {
        throw primaryError;
      }
    }

    try {
      await ensureElectionIndexes();
      await ensureDefaultAdmin();
    } catch (indexError) {
      console.warn("Notice: could not ensure election indexes or default admin:", indexError.message);
    }

    return mongoose.connection;
  })().catch((error) => {
    connectionPromise = null;
    console.error("Warning: Database could not be reached on startup:", error.message);
    return null;
  });

  return connectionPromise;
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function requireDatabaseConnection(_req, res, next) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({
      message: "Database service is temporarily unavailable. Please check MongoDB configuration.",
      databaseConnected: false,
    });
  }
  next();
}

async function disconnectFromDatabase() {
  connectionPromise = null;

  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  isDatabaseConnected,
  requireDatabaseConnection,
};
