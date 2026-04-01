const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "student", "teacher"],
      required: true,
    },
    studentId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    major: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    walletAddress: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    verificationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "verified"],
      default: "not_submitted",
    },
    walletSubmittedAt: Date,
    verifiedAt: Date,
    lastVerificationTxHash: String,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1, verificationStatus: 1 });

module.exports = mongoose.model("User", userSchema);
