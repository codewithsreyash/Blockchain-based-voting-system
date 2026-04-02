const mongoose = require("mongoose");
const {
  mongodbUri,
  mongodbServerSelectionTimeoutMs,
  mongodbSocketTimeoutMs,
} = require("../config/env");

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

async function connectToDatabase() {
  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);
  registerConnectionListeners();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(mongodbUri, {
        serverSelectionTimeoutMS: mongodbServerSelectionTimeoutMs,
        socketTimeoutMS: mongodbSocketTimeoutMs,
      })
      .catch((error) => {
        connectionPromise = null;
        throw new Error(`Unable to connect to MongoDB: ${error.message}`);
      });
  }

  await connectionPromise;
  return mongoose.connection;
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
};
