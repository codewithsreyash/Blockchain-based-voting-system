const express = require("express");
const { z } = require("zod");
const { authenticate, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { createHttpError } = require("../utils/httpError");
const { getWriteContract, resolveContractNetwork, sendAdminTransaction } = require("../lib/contract");
const {
  fetchElection,
  fetchAllElections,
  fetchElectionResults,
  isElectionEligibleToRole,
  isElectionVisibleToRole,
  syncElectionRecord,
} = require("../utils/elections");

const router = express.Router();

const absoluteDateTimePattern = /(Z|[+-]\d{2}:\d{2})$/i;

function parseAbsoluteDateTime(value) {
  if (typeof value !== "string" || !absoluteDateTimePattern.test(value)) {
    return null;
  }

  const parsedTime = Date.parse(value);
  return Number.isFinite(parsedTime) ? parsedTime : null;
}

const createElectionSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters long"),
    description: z.string().trim().min(10, "Description must be at least 10 characters long"),
    eligibleVoters: z.enum(["students", "teachers", "both"]),
    candidateNames: z
      .array(z.string().trim().min(1, "Candidate names cannot be empty"))
      .min(2, "At least two candidate names are required")
      .max(50, "No more than 50 candidates are allowed"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
  })
  .superRefine((value, ctx) => {
    const startTime = parseAbsoluteDateTime(value.startTime);
    const endTime = parseAbsoluteDateTime(value.endTime);

    if (startTime === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Start time must be a valid ISO date and time with a timezone offset",
      });
    }

    if (endTime === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be a valid ISO date and time with a timezone offset",
      });
    }

    if (startTime === null || endTime === null) {
      return;
    }

    if (startTime <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startTime"],
        message: "Start time must be in the future",
      });
    }

    if (endTime <= startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }
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

async function syncElectionRecordSafely(network, electionId) {
  if (!electionId) {
    return;
  }

  try {
    const election = await fetchElection(network, electionId);
    await syncElectionRecord(network, election);
  } catch (error) {
    console.error(`Unable to sync election ${electionId} metadata for ${network}`, error);
  }
}

router.post(
  "/",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const payload = createElectionSchema.parse(req.body);
    const { studentsAllowed, teachersAllowed } = getEligibilityFlags(payload.eligibleVoters);
    const startTimeMs = parseAbsoluteDateTime(payload.startTime);
    const endTimeMs = parseAbsoluteDateTime(payload.endTime);

    if (startTimeMs === null || endTimeMs === null) {
      throw createHttpError(400, "Election times must be absolute ISO timestamps with timezone offsets");
    }

    const startTime = Math.floor(startTimeMs / 1000);
    const endTime = Math.floor(endTimeMs / 1000);

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
      "Election creation",
      network
    );
    const electionId = parseElectionId(receipt, getWriteContract(network).interface);
    await syncElectionRecordSafely(network, electionId);

    res.status(201).json({
      network,
      electionId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      contractAddress: getWriteContract(network).target,
      gasLimit,
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const elections = (await fetchAllElections(network)).filter((election) => election.isActive);

    if (req.user.role === "admin") {
      return res.json({ elections, network });
    }

    if (req.user.verificationStatus !== "verified") {
      return res.json({
        network,
        elections: [],
        message: "Your wallet must be verified by an admin before you can see eligible elections",
      });
    }

    const visibleElections = elections.filter((election) => isElectionVisibleToRole(req.user.role, election));
    return res.json({ elections: visibleElections, network });
  })
);

router.get(
  "/:electionId/results",
  authenticate,
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const electionId = parseElectionIdParam(req.params.electionId);
    let election;

    try {
      election = await fetchElection(network, electionId);
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    try {
      await syncElectionRecord(network, election);
    } catch (error) {
      console.error(`Unable to sync election ${electionId} metadata before reading results for ${network}`, error);
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

    const results = await fetchElectionResults(network, electionId);
    res.json({
      ...results,
      network,
    });
  })
);

router.get(
  "/:electionId",
  authenticate,
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const electionId = parseElectionIdParam(req.params.electionId);
    let election;

    try {
      election = await fetchElection(network, electionId);
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    if (
      req.user.role !== "admin" &&
      (!isElectionVisibleToRole(req.user.role, election) || req.user.verificationStatus !== "verified")
    ) {
      throw createHttpError(403, "You are not allowed to view this election");
    }

    res.json({ election, network });
  })
);

router.patch(
  "/:electionId/deactivate",
  authenticate,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const network = resolveContractNetwork(req.query.network);
    const electionId = parseElectionIdParam(req.params.electionId);
    let election;

    try {
      election = await fetchElection(network, electionId);
    } catch (error) {
      throw createHttpError(404, "Election not found");
    }

    if (!election.isActive) {
      throw createHttpError(400, "Election is already hidden");
    }

    const { receipt, gasLimit } = await sendAdminTransaction(
      "deactivateElection",
      [electionId],
      `Automatic election deactivation for ${election.title}`,
      network
    );
    await syncElectionRecordSafely(network, electionId);

    res.json({
      network,
      electionId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasLimit,
      message: "Election hidden successfully",
    });
  })
);

module.exports = router;
