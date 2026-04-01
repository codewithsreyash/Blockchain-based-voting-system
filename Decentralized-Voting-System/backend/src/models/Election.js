const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    electionId: {
      type: Number,
      required: true,
      unique: true,
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

module.exports = mongoose.model("Election", electionSchema);
