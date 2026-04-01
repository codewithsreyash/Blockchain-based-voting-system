const mongoose = require("mongoose");
const { mongodbUri } = require("../config/env");

async function connectToDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongodbUri);
}

module.exports = {
  connectToDatabase,
};
