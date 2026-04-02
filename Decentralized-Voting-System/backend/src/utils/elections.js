const { getReadContractAsync } = require("../lib/contract");
const ElectionRecord = require("../models/Election");

function mapEligibleVoters(studentsAllowed, teachersAllowed) {
  if (studentsAllowed && teachersAllowed) {
    return "both";
  }

  if (studentsAllowed) {
    return "students";
  }

  if (teachersAllowed) {
    return "teachers";
  }

  return "none";
}

function isElectionEligibleToRole(role, election) {
  if (role === "admin") {
    return true;
  }

  if (role === "student") {
    return election.studentsAllowed;
  }

  if (role === "teacher") {
    return election.teachersAllowed;
  }

  return false;
}

function isElectionVisibleToRole(role, election) {
  if (!election.isActive) {
    return false;
  }

  return isElectionEligibleToRole(role, election);
}

function shouldRevealVoteCounts(election, includeVoteCounts) {
  return includeVoteCounts || Math.floor(Date.now() / 1000) >= election.endTime;
}

async function getDeletedElectionIdSet(network) {
  const deletedRecords = await ElectionRecord.find(
    {
      network,
      deletedAt: { $ne: null },
    },
    { electionId: 1 }
  ).lean();

  return new Set(deletedRecords.map((record) => record.electionId));
}

async function isElectionDeleted(network, electionId) {
  const deletedRecord = await ElectionRecord.exists({
    network,
    electionId,
    deletedAt: { $ne: null },
  });

  return Boolean(deletedRecord);
}

async function fetchElection(network, electionId, options = {}) {
  if (options.includeDeleted !== true && (await isElectionDeleted(network, electionId))) {
    const error = new Error("Election has been deleted from the dashboard");
    error.code = "ELECTION_DELETED";
    throw error;
  }

  const readContract = await getReadContractAsync(network);
  const electionData = await readContract.getElection(electionId);

  const election = {
    network,
    id: Number(electionData[0]),
    title: electionData[1],
    description: electionData[2],
    startTime: Number(electionData[3]),
    endTime: Number(electionData[4]),
    isActive: electionData[5],
    studentsAllowed: electionData[6],
    teachersAllowed: electionData[7],
    candidateCount: Number(electionData[8]),
    eligibleVoters: mapEligibleVoters(electionData[6], electionData[7]),
  };
  const revealVoteCounts = shouldRevealVoteCounts(election, options.includeVoteCounts === true);
  const candidateIds = Array.from({ length: election.candidateCount }, (_value, index) => index + 1);
  const candidates = await Promise.all(
    candidateIds.map(async (candidateId) => {
      const candidateData = await readContract.getCandidate(electionId, candidateId);

      return {
        id: Number(candidateData[0]),
        name: candidateData[1],
        metadataURI: candidateData[2],
        voteCount: revealVoteCounts ? Number(candidateData[3]) : 0,
      };
    })
  );

  return {
    ...election,
    candidates,
  };
}

function serializeElectionRecord(record) {
  return {
    network: record.network,
    id: record.electionId,
    title: record.title,
    description: record.description,
    startTime: Math.floor(new Date(record.startTime).getTime() / 1000),
    endTime: Math.floor(new Date(record.endTime).getTime() / 1000),
    isActive: record.isActive,
    studentsAllowed: record.studentsAllowed,
    teachersAllowed: record.teachersAllowed,
    eligibleVoters: record.eligibleVoters,
    candidateCount: record.candidateCount,
  };
}

function buildElectionRecordUpdate(election) {
  return {
    network: election.network,
    electionId: election.id,
    title: election.title,
    description: election.description,
    startTime: new Date(election.startTime * 1000),
    endTime: new Date(election.endTime * 1000),
    isActive: election.isActive,
    studentsAllowed: election.studentsAllowed,
    teachersAllowed: election.teachersAllowed,
    eligibleVoters: election.eligibleVoters,
    candidateCount: election.candidateCount,
  };
}

async function syncElectionRecord(network, election) {
  const record = await ElectionRecord.findOneAndUpdate(
    { network, electionId: election.id },
    {
      $set: {
        ...buildElectionRecordUpdate(election),
        network,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return serializeElectionRecord(record);
}

async function deleteElectionRecord(network, electionId, deletedBy) {
  const record = await ElectionRecord.findOneAndUpdate(
    { network, electionId },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: deletedBy || null,
      },
    },
    {
      new: true,
    }
  );

  return record ? serializeElectionRecord(record) : null;
}

async function getElectionMetadata(network, electionId, fallbackElection) {
  const existingRecord = await ElectionRecord.findOne({ network, electionId }).lean();

  if (existingRecord) {
    return serializeElectionRecord(existingRecord);
  }

  if (fallbackElection) {
    return syncElectionRecord(network, fallbackElection);
  }

  const election = await fetchElection(network, electionId);
  return syncElectionRecord(network, election);
}

async function fetchElectionResults(network, electionId) {
  const election = await fetchElection(network, electionId, { includeVoteCounts: true });
  const metadata = await getElectionMetadata(network, electionId, election);
  const totalVotes = election.candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0);
  const highestVoteCount = totalVotes > 0 ? Math.max(...election.candidates.map((candidate) => candidate.voteCount)) : 0;

  const candidates = election.candidates.map((candidate) => ({
    ...candidate,
    percentage: totalVotes > 0 ? Number(((candidate.voteCount / totalVotes) * 100).toFixed(1)) : 0,
    isWinner: totalVotes > 0 && candidate.voteCount === highestVoteCount,
  }));
  const winners = candidates.filter((candidate) => candidate.isWinner);

  return {
    election: metadata,
    totalVotes,
    hasTie: winners.length > 1,
    winners,
    candidates,
  };
}

async function fetchAllElections(network, options = {}) {
  const readContract = await getReadContractAsync(network);
  const count = Number(await readContract.electionCount());
  const deletedElectionIds = await getDeletedElectionIdSet(network);
  const electionIds = Array.from({ length: count }, (_value, index) => index + 1).filter(
    (electionId) => !deletedElectionIds.has(electionId)
  );

  return Promise.all(electionIds.map((electionId) => fetchElection(network, electionId, options)));
}

module.exports = {
  deleteElectionRecord,
  fetchElection,
  fetchAllElections,
  fetchElectionResults,
  getElectionMetadata,
  isElectionDeleted,
  isElectionEligibleToRole,
  isElectionVisibleToRole,
  syncElectionRecord,
};
