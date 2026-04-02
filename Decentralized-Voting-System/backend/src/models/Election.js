const mongoose = require("mongoose");

function normalizeElectionDate(value) {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsedDate.getTime()) ? parsedDate : value;
}

function isValidStoredElectionDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

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
      set: normalizeElectionDate,
      validate: {
        validator: isValidStoredElectionDate,
        message: "Start time must be stored as an absolute UTC timestamp",
      },
    },
    endTime: {
      type: Date,
      required: true,
      set: normalizeElectionDate,
      validate: {
        validator: isValidStoredElectionDate,
        message: "End time must be stored as an absolute UTC timestamp",
      },
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
