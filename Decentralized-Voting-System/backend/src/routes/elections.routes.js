const express = require("express");
const { z } = require("zod");
const { authenticate, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { createHttpError } = require("../utils/httpError");
const { writeContract, sendAdminTransaction } = require("../lib/contract");
const {
  fetchElection,
  fetchAllElections,
  fetchElectionResults,
  isElectionEligibleToRole,
  isElectionVisibleToRole,
  syncElectionRecord,
} = require("../utils/elections");

const router = express.Router();

const createElectionSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  eligibleVoters: z.enum(["students", "teachers", "both"]),
  candidateNames: z.array(z.string().min(1)).min(2).max(50),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

function getEligibilityFlags(eligibleVoters) {
  return {
    studentsAllowed: eligibleVoters === "students" || eligibleVoters === "both",
    teachersAllowed: eligibleVoters === "teachers" || eligibleVoters === "both",
  };
}

function parseElectionId(receipt, contractInterface) {
  for (const log of receipt.logs) {
    try {
      const parsedLog = contractInterface.parseLog(log);
      if (parsedLog && parsedLog.name === "ElectionCreated") {
        return Number(parsedLog.args.electionId);
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

function parseElectionIdParam(electionIdParam) {
  const electionId = Number(electionIdParam);

  if (!Number.isInteger(electionId) || electionId <= 0) {
    throw createHttpError(400, "Election id must be a positive integer");
  }

  return electionId;
}

async function syncElectionRecordSafely(electionId) {
  if (!electionId) {
    return;
  }

  try {
    const election = await fetchElection(electionId);
    await syncElectionRecord(election);
  } catch (error) {
    console.error(`Unable to sync election ${electionId} metadata`, error);
  }
}

router.post(
  "/",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const payload = createElectionSchema.parse(req.body);
    const { studentsAllowed, teachersAllowed } = getEligibilityFlags(payload.eligibleVoters);
    const startTime = Math.floor(new Date(payload.startTime).getTime() / 1000);
    const endTime = Math.floor(new Date(payload.endTime).getTime() / 1000);

    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      throw createHttpError(400, "Start and end times must be valid ISO date strings");
    }

    const { receipt, gasLimit } = await sendAdminTransaction(
      "createElection",
      [
        payload.title,
        payload.description,
        payload.candidateNames,
        studentsAllowed,
        teachersAllowed,
        startTime,
        endTime,
      ],
      `Automatic election creation for ${payload.title}`
    );
    const electionId = parseElectionId(receipt, writeContract.interface);
    await syncElectionRecordSafely(electionId);

    res.status(201).json({
      electionId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasLimit,
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const elections = (await fetchAllElections()).filter((election) => election.isActive);

    if (req.user.role === "admin") {
      return res.json({ elections });
    }

    if (req.user.verificationStatus !== "verified") {
      return res.json({
        elections: [],
        message: "Your wallet must be verified by an admin before you can see eligible elections",
      });
    }

    const visibleElections = elections.filter((election) => isElectionVisibleToRole(req.user.role, election));
    return res.json({ elections: visibleElections });
  })
);

router.get(
  "/:electionId/results",
  authenticate,
  asyncHandler(async (req, res) => {
    const electionId = parseElectionIdParam(req.params.electionId);
    let election;

    try {
      election = await fetchElection(electionId);
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    try {
      await syncElectionRecord(election);
    } catch (error) {
      console.error(`Unable to sync election ${electionId} metadata before reading results`, error);
    }

    if (
      req.user.role !== "admin" &&
      (!isElectionEligibleToRole(req.user.role, election) || req.user.verificationStatus !== "verified")
    ) {
      throw createHttpError(403, "You are not allowed to view these election results");
    }

    if (Math.floor(Date.now() / 1000) < election.endTime) {
      throw createHttpError(409, "Results are only available after voting ends");
    }

    const results = await fetchElectionResults(electionId);
    res.json(results);
  })
);

router.get(
  "/:electionId",
  authenticate,
  asyncHandler(async (req, res) => {
    const electionId = parseElectionIdParam(req.params.electionId);
    let election;

    try {
      election = await fetchElection(electionId);
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    if (
      req.user.role !== "admin" &&
      (!isElectionVisibleToRole(req.user.role, election) || req.user.verificationStatus !== "verified")
    ) {
      throw createHttpError(403, "You are not allowed to view this election");
    }

    res.json({ election });
  })
);

router.patch(
  "/:electionId/deactivate",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const electionId = parseElectionIdParam(req.params.electionId);
    let election;

    try {
      election = await fetchElection(electionId);
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    if (!election.isActive) {
      throw createHttpError(400, "Election is already hidden");
    }

    const { receipt, gasLimit } = await sendAdminTransaction(
      "deactivateElection",
      [electionId],
      `Automatic election deactivation for ${election.title}`
    );
    await syncElectionRecordSafely(electionId);

    res.json({
      electionId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasLimit,
      message: "Election hidden successfully",
    });
  })
);

module.exports = router;
