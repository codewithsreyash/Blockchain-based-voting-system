"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readContract, waitForTransactionReceipt } from "@wagmi/core";
import { useAccount, useConnect, useWriteContract } from "wagmi";
import { api } from "../../lib/api";
import { votingAbi } from "../../lib/contracts/votingAbi";
import { wagmiConfig } from "../../lib/wagmi";
import type { Election, User } from "../../lib/types";

const alreadyVotedNotice = "You have already voted in this election.";

const votingStatusAbi = [
  {
    type: "function",
    name: "hasVoted",
    stateMutability: "view",
    inputs: [
      {
        name: "electionId",
        type: "uint256",
      },
      {
        name: "voter",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },
] as const;

function toReadableDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function isAlreadyVotedError(errorMessage: string) {
  return errorMessage.includes("Vote already cast");
}

function getElectionStateAtTime(election: Election, currentUnixTime: number) {
  if (currentUnixTime < election.startTime) {
    return "Upcoming";
  }

  if (currentUnixTime >= election.endTime) {
    return "Closed";
  }

  return "Live";
}

function isElectionLive(election: Election, currentUnixTime: number) {
  return getElectionStateAtTime(election, currentUnixTime) === "Live";
}

export function ElectionDashboard() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();
  const [user, setUser] = useState<User | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUnixTime, setCurrentUnixTime] = useState(0);
  const [deactivatingElectionId, setDeactivatingElectionId] = useState<number | null>(null);
  const [alreadyVotedByElection, setAlreadyVotedByElection] = useState<Record<number, boolean>>({});

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` | undefined;
  const availableConnectors = useMemo(() => connectors.filter((connector) => connector.id !== "mock"), [connectors]);

  function getConnectorLabel(connectorId: string, connectorName: string) {
    if (connectorId === "walletConnect") {
      return "WalletConnect";
    }

    if (connectorId === "injected") {
      return "Browser Wallet";
    }

    return connectorName;
  }

  useEffect(() => {
    setIsMounted(true);
    setCurrentUnixTime(Date.now() / 1000);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    let active = true;

    Promise.all([api.me(), api.listElections()])
      .then(([currentUser, electionResponse]) => {
        if (!active) {
          return;
        }

        setUser(currentUser);
        setElections(electionResponse.elections);
        if (electionResponse.message) {
          setMessage(electionResponse.message);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load elections");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentUnixTime(Date.now() / 1000);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !contractAddress || !isConnected || !address) {
      setAlreadyVotedByElection({});
      return;
    }

    const activeElectionIds = elections.filter((election) => election.isActive).map((election) => election.id);
    if (!activeElectionIds.length) {
      setAlreadyVotedByElection({});
      return;
    }

    let active = true;

    Promise.all(
      activeElectionIds.map(async (electionId) => {
        const hasAlreadyVoted = await readContract(wagmiConfig, {
          address: contractAddress,
          abi: votingStatusAbi,
          functionName: "hasVoted",
          args: [BigInt(electionId), address],
        });

        return [electionId, Boolean(hasAlreadyVoted)] as const;
      })
    )
      .then((results) => {
        if (!active) {
          return;
        }

        setAlreadyVotedByElection(
          results.reduce<Record<number, boolean>>((statusMap, [electionId, hasAlreadyVoted]) => {
            statusMap[electionId] = hasAlreadyVoted;
            return statusMap;
          }, {})
        );
      })
      .catch(() => {
        if (active) {
          setAlreadyVotedByElection({});
        }
      });

    return () => {
      active = false;
    };
  }, [address, contractAddress, elections, isConnected, isMounted]);

  async function castVote(election: Election) {
    if (!contractAddress) {
      setError("Missing NEXT_PUBLIC_CONTRACT_ADDRESS");
      return;
    }

    if (!isElectionLive(election, Date.now() / 1000)) {
      setError("Voting is not currently open for this election");
      return;
    }

    const candidateId = selectedCandidates[election.id];
    if (!candidateId) {
      setError("Choose a candidate before voting");
      return;
    }

    if (!address || !isConnected) {
      setError("Connect the verified wallet linked to your account before voting");
      return;
    }

    if (user?.walletAddress && user.walletAddress !== address.toLowerCase()) {
      setError("The connected wallet does not match the wallet approved by the admin");
      return;
    }

    if (alreadyVotedByElection[election.id]) {
      setError("");
      return;
    }

    setError("");
    setMessage("");

    try {
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: votingAbi,
        functionName: "vote",
        args: [BigInt(election.id), BigInt(candidateId)],
      });

      await waitForTransactionReceipt(wagmiConfig, { hash });
      setMessage(`Vote confirmed for election #${election.id}.`);
      setAlreadyVotedByElection((current) => ({
        ...current,
        [election.id]: true,
      }));

      const refreshed = await api.listElections();
      setElections(refreshed.elections);
    } catch (voteError) {
      const errorMessage = voteError instanceof Error ? voteError.message : "Vote failed";

      if (isAlreadyVotedError(errorMessage)) {
        setAlreadyVotedByElection((current) => ({
          ...current,
          [election.id]: true,
        }));
        setError("");
        return;
      }

      setError(errorMessage);
    }
  }

  async function hideElection(election: Election) {
    setDeactivatingElectionId(election.id);
    setError("");
    setMessage("");

    try {
      const response = await api.deactivateElection(election.id);
      setMessage(response.message);
      setElections((current) => current.filter((currentElection) => currentElection.id !== election.id));
    } catch (deactivationError) {
      setError(deactivationError instanceof Error ? deactivationError.message : "Unable to hide election");
    } finally {
      setDeactivatingElectionId(null);
    }
  }

  return (
    <div className="stack-xl">
      <div className="panel hero-panel">
        <p className="eyebrow">Election Feed</p>
        <h1>Only elections your role can participate in are shown here</h1>
        <p className="muted">
          Teachers see teacher-eligible elections, students see student-eligible elections, and the contract enforces
          the same rule during the vote transaction.
        </p>
        {user?.walletAddress ? <p className="mono-callout">Verified wallet: {user.walletAddress}</p> : null}
      </div>

      {!isConnected ? (
        <div className="panel">
          <h2>Connect the verified wallet before voting</h2>
          <div className="stack-md">
            {availableConnectors.map((connector) => (
              <button
                className="button"
                key={connector.uid}
                type="button"
                onClick={() => connect({ connector })}
                disabled={!connector}
              >
                {`Connect ${getConnectorLabel(connector.id, connector.name)}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <p className="message">Loading elections...</p> : null}
      {message ? <p className="message success">{message}</p> : null}
      {error ? <p className="message error">{error}</p> : null}

      {!isMounted ? (
        <div className="grid">
          <section className="panel">
            <p className="eyebrow">Election Status</p>
            <h2>Loading elections...</h2>
            <p className="muted">Preparing live voting windows and ballot availability.</p>
          </section>
        </div>
      ) : (
        <div className="grid">
          {elections.filter((election) => election.isActive).map((election) => {
            const electionState = getElectionStateAtTime(election, currentUnixTime);
            const votingOpen = electionState === "Live";
            const alreadyVoted = Boolean(alreadyVotedByElection[election.id]);
            const voteButtonDisabled = isPending || !votingOpen || alreadyVoted;
            const canHideElection = user?.role === "admin" && electionState === "Closed";

            return (
              <section className="panel" key={election.id}>
                <div className="row-between">
                  <div>
                    <p className="eyebrow">Election #{election.id}</p>
                    <h2>{election.title}</h2>
                  </div>
                  <span className={`state-chip ${electionState.toLowerCase()}`}>{electionState}</span>
                </div>

                <p className="muted">{election.description}</p>
                <p className="muted">Eligible voters: {election.eligibleVoters}</p>
                <p className="muted">
                  Window: {toReadableDate(election.startTime)} to {toReadableDate(election.endTime)}
                </p>

                <div className="stack-md">
                  {election.candidates.map((candidate) => (
                    <label className="candidate-card" key={candidate.id}>
                      <input
                        type="radio"
                        name={`election-${election.id}`}
                        checked={selectedCandidates[election.id] === candidate.id}
                        onChange={() =>
                          setSelectedCandidates((current) => ({
                            ...current,
                            [election.id]: candidate.id,
                          }))
                        }
                        disabled={!votingOpen || alreadyVoted}
                      />
                      <span>{candidate.name}</span>
                      <span className="muted">{votingOpen ? "Ballot option" : "Results published after close"}</span>
                    </label>
                  ))}
                </div>

                {!votingOpen ? (
                  <p className="message">
                    {electionState === "Closed"
                      ? "Voting has ended for this election."
                      : "Voting has not started for this election yet."}
                  </p>
                ) : null}

                {electionState === "Closed" ? (
                  <Link className="button" href={`/elections/${election.id}/results`}>
                    View Results
                  </Link>
                ) : (
                  <button
                    className="button"
                    type="button"
                    onClick={() => castVote(election)}
                    disabled={voteButtonDisabled}
                  >
                    {isPending
                      ? "Submitting vote..."
                      : alreadyVoted
                        ? "Already Voted"
                        : electionState === "Upcoming"
                          ? "Voting not started"
                          : "Cast vote"}
                  </button>
                )}

                {alreadyVoted ? <p className="message">{alreadyVotedNotice}</p> : null}

                {user?.role === "admin" ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => hideElection(election)}
                    disabled={!canHideElection || deactivatingElectionId === election.id}
                  >
                    {deactivatingElectionId === election.id
                      ? "Hiding election..."
                      : canHideElection
                        ? "Hide election"
                        : "Hide after close"}
                  </button>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
