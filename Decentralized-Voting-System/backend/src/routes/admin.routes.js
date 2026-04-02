const express = require("express");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { createHttpError } = require("../utils/httpError");
const { chunkArray } = require("../utils/chunk");
const {
  deleteElectionRecord,
  fetchElection,
  isElectionDeleted,
  syncElectionRecord,
} = require("../utils/elections");
const {
  ensureDemoWalletFunds,
  getContractRole,
  resolveContractNetwork,
  sendAdminTransaction,
} = require("../lib/contract");
const { verificationBatchSize } = require("../config/env");

const router = express.Router();
const MAX_CONTRACT_BATCH_SIZE = 100;

function parseElectionIdParam(electionIdParam) {
  const electionId = Number(electionIdParam);

  if (!Number.isInteger(electionId) || electionId <= 0) {
    throw createHttpError(400, "Election id must be a positive integer");
  }

  return electionId;
}

async function verifyUserBatch(users, network) {
  const addresses = users.map((user) => user.walletAddress);
  const roles = users.map((user) => getContractRole(user.role));

  if (users.length === 1) {
    const { receipt, gasLimit } = await sendAdminTransaction(
      "verifyVoter",
      [addresses[0], roles[0]],
      `Automatic verification for ${users[0].email}`,
      network
    );
    const funding = await ensureDemoWalletFunds(network, addresses[0]);
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasLimit,
      fundingTransactions: funding ? [funding.transactionHash] : [],
    };
  }

  const { receipt, gasLimit } = await sendAdminTransaction(
    "verifyVoters",
    [addresses, roles],
    `Automatic bulk verification for ${users.length} users`,
    network
  );
  const fundingTransactions = [];

  for (const address of addresses) {
    const funding = await ensureDemoWalletFunds(network, address);
    if (funding) {
      fundingTransactions.push(funding.transactionHash);
    }
  }

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasLimit,
    fundingTransactions,
  };
}

router.get(
  "/verifications",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const filter = {
      verificationStatus: "pending",
      walletAddress: { $exists: true, $ne: null },
    };

    if (req.query.role === "student" || req.query.role === "teacher") {
      filter.role = req.query.role;
      const users = await User.find(filter).sort({ createdAt: 1 });
      return res.json({ users });
    }

    const [students, teachers] = await Promise.all([
      User.find({ ...filter, role: "student" }).sort({ createdAt: 1 }),
      User.find({ ...filter, role: "teacher" }).sort({ createdAt: 1 }),
    ]);

    return res.json({ students, teachers });
  })
);

router.post(
  "/verifications/bulk",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const roleFilter = req.body.role === "student" || req.body.role === "teacher" ? req.body.role : undefined;
    const query = {
      verificationStatus: "pending",
      walletAddress: { $exists: true, $ne: null },
    };

    if (roleFilter) {
      query.role = roleFilter;
    }

    const pendingUsers = await User.find(query).sort({ createdAt: 1 });

    if (!pendingUsers.length) {
      return res.json({
        verifiedCount: 0,
        transactionHashes: [],
      });
    }

    const safeBatchSize = Math.max(1, Math.min(verificationBatchSize, MAX_CONTRACT_BATCH_SIZE));
    const batches = chunkArray(pendingUsers, safeBatchSize);
    const transactionHashes = [];
    const batchResults = [];
    let verifiedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];
      const verification = await verifyUserBatch(batch, network);
      transactionHashes.push(verification.transactionHash);
      batchResults.push({
        batchNumber: batchIndex + 1,
        userCount: batch.length,
        transactionHash: verification.transactionHash,
        gasLimit: verification.gasLimit,
        fundingTransactions: verification.fundingTransactions,
      });
      verifiedCount += batch.length;

      await User.updateMany(
        { _id: { $in: batch.map((user) => user._id) } },
        {
          $set: {
            verificationStatus: "verified",
            verifiedAt: new Date(),
            lastVerificationTxHash: verification.transactionHash,
          },
        }
      );
    }

    res.json({
      network,
      verifiedCount,
      batchCount: batches.length,
      transactionHashes,
      batchResults,
    });
  })
);

router.post(
  "/verifications/:userId([0-9a-fA-F]{24})",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const user = await User.findById(req.params.userId);

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (!user.walletAddress) {
      throw createHttpError(400, "User has not submitted a wallet address yet");
    }

    if (user.verificationStatus !== "pending") {
      throw createHttpError(400, "User is not pending verification");
    }

    const verification = await verifyUserBatch([user], network);

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        verificationStatus: "verified",
        verifiedAt: new Date(),
        lastVerificationTxHash: verification.transactionHash,
      },
      { new: true }
    );

    res.json({
      network,
      user: updatedUser,
      transactionHash: verification.transactionHash,
      blockNumber: verification.blockNumber,
      gasLimit: verification.gasLimit,
      fundingTransactions: verification.fundingTransactions,
    });
  })
);

router.delete(
  "/elections/:electionId",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const electionId = parseElectionIdParam(req.params.electionId);

    if (await isElectionDeleted(network, electionId)) {
      throw createHttpError(400, "Election is already deleted from the dashboard");
    }

    let election;

    try {
      election = await fetchElection(network, electionId, { includeDeleted: true });
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    await syncElectionRecord(network, election);
    await deleteElectionRecord(network, electionId, req.user._id);

    res.json({
      network,
      electionId,
      message: `Election "${election.title}" deleted from the dashboard`,
    });
  })
);

module.exports = router;
