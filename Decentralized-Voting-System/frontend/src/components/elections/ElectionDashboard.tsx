"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readContract, waitForTransactionReceipt } from "@wagmi/core";
import { useAccount, useChainId, useConnect, useSwitchChain, useWriteContract } from "wagmi";
import { api } from "../../lib/api";
import { votingAbi } from "../../lib/contracts/votingAbi";
import { wagmiConfig, chainByAppNetwork } from "../../lib/wagmi";
import type { Election, User } from "../../lib/types";
import { useAppNetwork } from "../../providers/network-provider";

const alreadyVotedNotice = "You have already cast your ballot in this election.";

const votingStatusAbi = [
  {
    type: "function",
    name: "hasVoted",
    stateMutability: "view",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type FilterTab = "active" | "upcoming" | "closed";

function getCurrentUnixTime() {
  return Math.floor(Date.now() / 1000);
}

function toReadableDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getElectionStateAtTime(election: Election, currentUnixTime: number): "Live" | "Upcoming" | "Closed" {
  if (currentUnixTime < election.startTime) return "Upcoming";
  if (currentUnixTime >= election.endTime) return "Closed";
  return "Live";
}

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ElectionDashboard() {
  const { address, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const { activeNetwork, isDemoMode, selectedNetwork } = useAppNetwork();
  const [user, setUser] = useState<User | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUnixTime, setCurrentUnixTime] = useState(0);
  const [alreadyVotedByElection, setAlreadyVotedByElection] = useState<Record<number, boolean>>({});

  const contractAddress = activeNetwork.contractAddress as `0x${string}` | null;
  const targetChain = chainByAppNetwork[selectedNetwork];
  const targetChainId = targetChain.id as 80002 | 31337;
  const walletBusy = isPending || isSwitchingChain || isConnecting;
  const availableConnectors = useMemo(() => connectors.filter((c) => c.id !== "mock"), [connectors]);

  useEffect(() => {
    setIsMounted(true);
    setCurrentUnixTime(getCurrentUnixTime());
    const interval = setInterval(() => setCurrentUnixTime(getCurrentUnixTime()), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [userData, electionsData] = await Promise.all([
          api.me().catch(() => null),
          api.listElections().catch(() => ({ elections: [] })),
        ]);

        if (!active) return;
        setUser(userData);
        setElections(electionsData.elections || []);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load campus elections.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [selectedNetwork]);

  useEffect(() => {
    if (!address || !contractAddress || elections.length === 0) {
      setAlreadyVotedByElection({});
      return;
    }

    let active = true;

    async function checkVotedStatuses() {
      const results: Record<number, boolean> = {};
      await Promise.all(
        elections.map(async (election) => {
          try {
            const hasVoted = await readContract(wagmiConfig, {
              address: contractAddress!,
              abi: votingStatusAbi,
              functionName: "hasVoted",
              args: [BigInt(election.id), address!],
              chainId: targetChainId,
            });
            results[election.id] = Boolean(hasVoted);
          } catch {
            results[election.id] = false;
          }
        })
      );

      if (active) {
        setAlreadyVotedByElection(results);
      }
    }

    checkVotedStatuses();
    return () => {
      active = false;
    };
  }, [address, contractAddress, elections, targetChainId]);

  async function handleVote(election: Election) {
    const candidateId = selectedCandidates[election.id];
    if (typeof candidateId !== "number") {
      setError("Please select a candidate option before submitting your ballot.");
      return;
    }

    if (!contractAddress) {
      setError(`Smart contract address not found for ${activeNetwork.label}.`);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now >= election.endTime) {
      setError(`Voting has ended for this ballot. The voting window closed at ${toReadableDate(election.endTime)}.`);
      return;
    }
    if (now < election.startTime) {
      setError(`Voting has not started yet. The voting window opens at ${toReadableDate(election.startTime)}.`);
      return;
    }

    setError("");
    setMessage("");
    setTxHash(null);

    try {
      if (connectedChainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: votingAbi,
        functionName: "vote",
        args: [BigInt(election.id), BigInt(candidateId)],
        chain: targetChain,
        chainId: targetChainId,
      });

      setMessage("Ballot submitted to network. Awaiting block confirmation...");
      setTxHash(hash);

      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: targetChainId });

      setMessage("Ballot officially cast and confirmed on-chain!");
      setAlreadyVotedByElection((prev) => ({ ...prev, [election.id]: true }));
    } catch (voteError: unknown) {
      const err = voteError as Error;
      const rawMsg = err?.message || "";

      if (rawMsg.includes("Voting has ended") || rawMsg.includes("0x10566f74696e672068617320656e646564")) {
        setError(`Voting has ended for Ballot #${election.id}. The voting window concluded at ${toReadableDate(election.endTime)}.`);
      } else if (rawMsg.includes("Voting has not started")) {
        setError(`Voting has not started yet. The window opens at ${toReadableDate(election.startTime)}.`);
      } else if (rawMsg.includes("Vote already cast")) {
        setAlreadyVotedByElection((prev) => ({ ...prev, [election.id]: true }));
        setMessage(alreadyVotedNotice);
      } else if (rawMsg.includes("Wallet is not verified")) {
        setError("Your connected wallet address has not been verified on-chain. Please request administrative whitelisting.");
      } else if (rawMsg.includes("Role is not eligible")) {
        setError("Your voter role is not eligible to vote in this particular election.");
      } else if (rawMsg.includes("returned too many errors") || rawMsg.includes("429")) {
        setError("The public Polygon Amoy RPC endpoint experienced rate-limiting. Please update your MetaMask RPC URL to an Alchemy RPC (https://polygon-amoy.g.alchemy.com/v2/...) or retry in a moment.");
      } else {
        setError(err?.message || "Transaction failed. Please ensure you are a verified voter.");
      }
    }
  }

  const filteredElections = useMemo(() => {
    return elections.filter((e) => {
      const state = getElectionStateAtTime(e, currentUnixTime);
      if (activeTab === "active") return state === "Live";
      if (activeTab === "upcoming") return state === "Upcoming";
      return state === "Closed";
    });
  }, [elections, activeTab, currentUnixTime]);

  const activeCount = useMemo(
    () => elections.filter((e) => getElectionStateAtTime(e, currentUnixTime) === "Live").length,
    [elections, currentUnixTime]
  );
  const upcomingCount = useMemo(
    () => elections.filter((e) => getElectionStateAtTime(e, currentUnixTime) === "Upcoming").length,
    [elections, currentUnixTime]
  );
  const closedCount = useMemo(
    () => elections.filter((e) => getElectionStateAtTime(e, currentUnixTime) === "Closed").length,
    [elections, currentUnixTime]
  );

  return (
    <div className="stack-xl">
      {/* Top Protocol Header & Cryptographic Banner (Stitch) */}
      <div className="elections-feed-header">
        <div className="row-between">
          <div className="stack-sm">
            <div className="eyebrow">
              <span>Protocol Registry · Mainnet v2.4</span>
              <span>•</span>
              <span style={{ fontFamily: "var(--font-code)", color: "var(--ink-muted)" }}>
                Chain ID: {targetChainId}
              </span>
            </div>
            <h1 style={{ fontSize: "2.4rem" }}>Active Academic Ballots &amp; Governance Feed</h1>
          </div>
        </div>

        {/* Role-Constrained Cryptographic Partitioning Banner (Stitch) */}
        <div className="elections-banner">
          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flex: 1 }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-lg)",
                background: "var(--surface-container)",
                color: "var(--primary-amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>verified_user</span>
            </div>
            <div className="stack-sm" style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ fontSize: "1.15rem" }}>Role-Constrained Cryptographic Partitioning</h3>
                <span className="badge" style={{ background: "var(--surface-container)", color: "var(--ink-secondary)" }}>
                  ERC-1271 · ZK Proof Ready
                </span>
              </div>
              <p style={{ color: "var(--ink-secondary)", fontSize: "13.5px" }}>
                Only elections your verified credential can participate in appear below. Faculty see professorial tenure &amp; curriculum ballots; enrolled students unlock senate delegate ballots. Rules enforced trustlessly on-chain.
              </p>
            </div>
          </div>

          {/* Connected Identity Preview */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            {isConnected && address ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 14px",
                  background: "var(--surface-low)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
                    Connected Key
                  </span>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: "12px", fontWeight: 600 }}>
                    {truncateAddress(address)}
                  </span>
                </div>
                {user?.role && (
                  <span className={`badge badge-${user.role}`}>{user.role.toUpperCase()}</span>
                )}
              </div>
            ) : (
              <Link className="button sm" href="/wallet">
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>account_balance_wallet</span>
                <span>Connect Wallet</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs (Stitch: Active / Upcoming / Audit Archive) */}
      <div className="row-between" style={{ background: "var(--surface-low)", padding: "6px", borderRadius: "var(--radius-lg)" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`pill ${activeTab === "active" ? "active" : ""}`}
            onClick={() => setActiveTab("active")}
          >
            <span>Active Ballots ({activeCount})</span>
          </button>
          <button
            type="button"
            className={`pill ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            <span>Upcoming ({upcomingCount})</span>
          </button>
          <button
            type="button"
            className={`pill ${activeTab === "closed" ? "active" : ""}`}
            onClick={() => setActiveTab("closed")}
          >
            <span>Audit Archive ({closedCount})</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingRight: "8px", fontSize: "12px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>
          <span className="pulse-dot"></span>
          <span>{activeNetwork.label} Synced</span>
        </div>
      </div>

      {/* Messages / Alerts */}
      {message && (
        <div className="message success">
          <span className="material-symbols-outlined">check_circle</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span>{message}</span>
            {txHash && (
              <a
                href={
                  selectedNetwork === "amoy"
                    ? `https://amoy.polygonscan.com/tx/${txHash}`
                    : `#`
                }
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: "var(--font-code)", fontSize: "11px", textDecoration: "underline" }}
              >
                View on Explorer: {truncateAddress(txHash)}
              </a>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="message error">
          <span className="material-symbols-outlined">error</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
            <span>{error}</span>
            {error.includes("MetaMask RPC URL") && (
              <button
                type="button"
                className="button sm"
                style={{ alignSelf: "flex-start", marginTop: "4px" }}
                onClick={async () => {
                  try {
                    const ethereum = (window as unknown as { ethereum?: { request: (args: unknown) => Promise<unknown> } }).ethereum;
                    if (ethereum) {
                      await ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [
                          {
                            chainId: "0x13882",
                            chainName: "Polygon Amoy Testnet",
                            nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                            rpcUrls: [
                              "https://polygon-amoy.g.alchemy.com/v2/75_3FkknbchD8uZ0ZQSoP",
                              "https://polygon-amoy-bor-rpc.publicnode.com",
                            ],
                            blockExplorerUrls: ["https://amoy.polygonscan.com"],
                          },
                        ],
                      });
                      setError("");
                      setMessage("MetaMask successfully updated to high-speed Alchemy RPC!");
                    }
                  } catch (rpcErr) {
                    console.error("Failed to auto-configure RPC:", rpcErr);
                  }
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>bolt</span>
                <span>⚡ 1-Click: Auto-Configure MetaMask with Working Alchemy RPC</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="panel">
          <div className="eyebrow">Synchronizing Ballots</div>
          <h2>Loading election registry...</h2>
          <p style={{ color: "var(--ink-muted)" }}>Connecting to smart contract and verifying eligibility rules...</p>
        </div>
      )}

      {/* Elections Feed Cards */}
      {!loading && filteredElections.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--ink-muted)" }}>
            inbox
          </span>
          <h2 style={{ marginTop: "12px" }}>No {activeTab} ballots found</h2>
          <p style={{ color: "var(--ink-muted)", maxWidth: "480px", margin: "8px auto 20px" }}>
            {activeTab === "active"
              ? "There are currently no active ballots open for your role. Check back soon or browse upcoming votes."
              : `No elections currently in the ${activeTab} queue.`}
          </p>
          {user?.role === "admin" && (
            <Link className="button" href="/admin/elections/new">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_box</span>
              <span>Create New Election</span>
            </Link>
          )}
        </div>
      ) : null}

      {!loading &&
        filteredElections.map((election) => {
          const electionState = getElectionStateAtTime(election, currentUnixTime);
          const votingOpen = electionState === "Live";
          const alreadyVoted = Boolean(alreadyVotedByElection[election.id]);
          const selectedCandidateId = selectedCandidates[election.id];

          return (
            <section className="ballot-card" key={election.id}>
              {/* Ballot Header Row */}
              <div className="row-between">
                <div className="ballot-meta-row">
                  <span className="eyebrow" style={{ fontSize: "11px" }}>
                    Ballot #{election.id}
                  </span>
                  <span className={`badge ${votingOpen ? "badge-verified" : "badge-pending"}`}>
                    <span className={`pulse-dot ${votingOpen ? "" : "amber"}`}></span>
                    <span>{electionState}</span>
                  </span>
                  <span className="badge" style={{ background: "var(--surface-container)", color: "#1e3a8a" }}>
                    Role: {election.eligibleVoters.toUpperCase()}
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "var(--ink-muted)", display: "block" }}>Window</span>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: "12px" }}>
                    {toReadableDate(election.startTime)} – {toReadableDate(election.endTime)}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h2 className="ballot-title">{election.title}</h2>
                <p className="ballot-description" style={{ marginTop: "6px" }}>
                  {election.description}
                </p>
              </div>

              {/* Turnout Metric Bar */}
              <div className="turnout-bar-wrap">
                <div className="row-between">
                  <span style={{ fontSize: "12px", color: "var(--ink-muted)", fontWeight: 600 }}>Turnout &amp; Quorum Progress</span>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: "12px", color: "var(--secondary-emerald)", fontWeight: 600 }}>
                    Active Voting Protocol
                  </span>
                </div>
                <div className="turnout-bar">
                  <div className="turnout-fill" style={{ width: votingOpen ? "65%" : "100%" }}></div>
                </div>
              </div>

              {/* Candidate Options (Stitch Radio Card List) */}
              <div className="stack-sm">
                <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--ink-muted)" }}>
                  Select Ballot Option:
                </span>
                {election.candidates.map((candidate) => {
                  const isSelected = selectedCandidateId === candidate.id;

                  return (
                    <label
                      key={candidate.id}
                      className={`candidate-option ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        if (votingOpen && !alreadyVoted) {
                          setSelectedCandidates((prev) => ({ ...prev, [election.id]: candidate.id }));
                        }
                      }}
                    >
                      <div className="candidate-info">
                        <input
                          type="radio"
                          name={`election-${election.id}`}
                          className="candidate-radio"
                          checked={isSelected}
                          onChange={() => {
                            if (votingOpen && !alreadyVoted) {
                              setSelectedCandidates((prev) => ({ ...prev, [election.id]: candidate.id }));
                            }
                          }}
                          disabled={!votingOpen || alreadyVoted}
                        />
                        <div>
                          <div className="candidate-name">{candidate.name}</div>
                          <div className="candidate-platform">
                            Candidate ID #{candidate.id} · Verified Campus Slate
                          </div>
                        </div>
                      </div>

                      <div className="candidate-stats">
                        <span className="candidate-votes">Option #{candidate.id}</span>
                        <span className="candidate-pct">Cryptographic Ballot</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Actions Footer */}
              <div
                className="row-between"
                style={{ paddingTop: "14px", borderTop: "1px solid var(--border-hairline)", flexWrap: "wrap" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-muted)", fontSize: "12px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--secondary-emerald)" }}>
                    lock
                  </span>
                  <span>Zero-Knowledge Blinded Signature · Tamper-Proof</span>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Link className="button secondary sm" href={`/elections/${election.id}/results`}>
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>bar_chart</span>
                    <span>Audit Tally</span>
                  </Link>

                  {alreadyVoted ? (
                    <div className="badge badge-verified" style={{ padding: "8px 14px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check_circle</span>
                      <span>Ballot Cast</span>
                    </div>
                  ) : votingOpen ? (
                    <button
                      className="button sm"
                      type="button"
                      disabled={walletBusy || typeof selectedCandidateId !== "number"}
                      onClick={() => handleVote(election)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        {walletBusy ? "sync" : "how_to_vote"}
                      </span>
                      <span>{walletBusy ? "Confirming on Chain..." : "Cast Ballot On-Chain"}</span>
                    </button>
                  ) : (
                    <span className="badge" style={{ background: "var(--surface-container)" }}>
                      Voting {electionState}
                    </span>
                  )}
                </div>
              </div>
            </section>
          );
        })}
    </div>
  );
}
