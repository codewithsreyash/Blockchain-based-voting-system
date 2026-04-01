const express = require("express");
const { ethers } = require("ethers");
const { z } = require("zod");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { createHttpError } = require("../utils/httpError");

const router = express.Router();

const walletSchema = z.object({
  walletAddress: z.string().min(42),
});

router.post(
  "/me/wallet",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = walletSchema.parse(req.body);
    const walletAddress = ethers.getAddress(payload.walletAddress).toLowerCase();

    const walletOwner = await User.findOne({
      walletAddress,
      _id: { $ne: req.user._id },
    });

    if (walletOwner) {
      throw createHttpError(409, "This wallet is already linked to another account");
    }

    const nextStatus = req.user.role === "admin" ? "verified" : "pending";

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        walletAddress,
        verificationStatus: nextStatus,
        walletSubmittedAt: new Date(),
        verifiedAt: nextStatus === "verified" ? new Date() : undefined,
      },
      { new: true }
    );

    res.json({
      user: updatedUser,
      message:
        nextStatus === "verified"
          ? "Admin wallet linked successfully"
          : "Wallet submitted successfully and is pending admin verification",
    });
  })
);

module.exports = router;
