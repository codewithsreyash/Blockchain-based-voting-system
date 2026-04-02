const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    network: {
      type: String,
      enum: ["amoy", "local"],
      required: true,
      default: "amoy",
      index: true,
    },
    electionId: {
      type: Number,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    eligibleVoters: {
      type: String,
      enum: ["students", "teachers", "both", "none"],
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    studentsAllowed: {
      type: Boolean,
      default: false,
    },
    teachersAllowed: {
      type: Boolean,
      default: false,
    },
    candidateCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

electionSchema.index({ network: 1, electionId: 1 }, { unique: true });

const Election = mongoose.models.Election || mongoose.model("Election", electionSchema);

async function ensureElectionIndexes() {
  const collection = Election.collection;

  try {
    const indexes = await collection.indexes();
    const legacyIndex = indexes.find((index) => index.name === "electionId_1" && index.unique);

    if (legacyIndex) {
      await collection.dropIndex("electionId_1");
    }
  } catch (error) {
    if (error.codeName !== "NamespaceNotFound" && error.code !== 26) {
      console.warn("Unable to inspect election indexes", error);
    }
  }

  await Election.syncIndexes();
}

module.exports = Election;
module.exports.ensureElectionIndexes = ensureElectionIndexes;
