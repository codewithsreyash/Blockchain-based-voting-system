"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readContract, waitForTransactionReceipt } from "@wagmi/core";
import { useAccount, useChainId, useConnect, useSwitchChain, useWriteContract } from "wagmi";
import { api } from "../../lib/api";
import { votingAbi } from "../../lib/contracts/votingAbi";
import { resolvePublicDemoRpcUrl } from "../../lib/network";
import { wagmiConfig, chainByAppNetwork } from "../../lib/wagmi";
import type { Election, User } from "../../lib/types";
import { useAppNetwork } from "../../providers/network-provider";

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

type ManualDemoNetworkInstructions = {
  chainId: number;
  currencySymbol: string;
  networkName: string;
  rpcUrl: string;
};

function getCurrentUnixTime() {
  return Math.floor(Date.now() / 1000);
}

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
  const connectedChainId = useChainId();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const { activeNetwork, isDemoMode, selectedNetwork } = useAppNetwork();
  const [user, setUser] = useState<User | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [currentUnixTime, setCurrentUnixTime] = useState(0);
  const [deactivatingElectionId, setDeactivatingElectionId] = useState<number | null>(null);
  const [deletingElectionId, setDeletingElectionId] = useState<number | null>(null);
  const [alreadyVotedByElection, setAlreadyVotedByElection] = useState<Record<number, boolean>>({});
  const [manualDemoNetworkInstructions, setManualDemoNetworkInstructions] = useState<ManualDemoNetworkInstructions | null>(
    null
  );

  const contractAddress = activeNetwork.contractAddress as `0x${string}` | null;
  const targetChain = chainByAppNetwork[selectedNetwork];
  const targetChainId = targetChain.id as 80002 | 31337;
  const walletBusy = isPending || isSwitchingChain || isConnecting;
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
    setCurrentUnixTime(getCurrentUnixTime());
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

        setMessage("");
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
  }, [isMounted, selectedNetwork]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentUnixTime(getCurrentUnixTime());
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
          chainId: targetChainId,
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
  }, [address, contractAddress, elections, isConnected, isMounted, targetChainId]);

  useEffect(() => {
    setError("");
    setMessage("");
    setSelectedCandidates({});
    setAlreadyVotedByElection({});
    setManualDemoNetworkInstructions(null);
  }, [selectedNetwork]);

  useEffect(() => {
    if (!isDemoMode || connectedChainId === targetChainId) {
      setManualDemoNetworkInstructions(null);
    }
  }, [connectedChainId, isDemoMode, targetChainId]);

  async function ensureWalletOnSelectedNetwork() {
    if (connectedChainId === targetChainId) {
      setManualDemoNetworkInstructions(null);
      return;
    }

    if (selectedNetwork === "local") {
      const publicDemoRpcUrl = resolvePublicDemoRpcUrl(activeNetwork.rpcUrl);
      const addEthereumChainParameter = {
        chainName: targetChain.name,
        nativeCurrency: targetChain.nativeCurrency,
        rpcUrls: [publicDemoRpcUrl],
        ...(activeNetwork.blockExplorerUrl ? { blockExplorerUrls: [activeNetwork.blockExplorerUrl] } : {}),
      };

      try {
        await switchChainAsync({
          addEthereumChainParameter,
          chainId: targetChainId,
        });
        setManualDemoNetworkInstructions(null);
        return;
      } catch (switchError) {
        setManualDemoNetworkInstructions({
          chainId: targetChainId,
          currencySymbol: targetChain.nativeCurrency.symbol,
          networkName: targetChain.name,
          rpcUrl: publicDemoRpcUrl,
        });

        const errorMessage = switchError instanceof Error ? switchError.message : "";
        if (errorMessage.includes("Demo Mode RPC is misconfigured")) {
          throw switchError;
        }

        throw new Error(
          `Your wallet could not switch to ${activeNetwork.label} automatically. Add the network manually in your wallet, reconnect if needed, and try again.`
        );
      }
    }

    await switchChainAsync({ chainId: targetChainId });
  }

  async function castVote(election: Election) {
    if (!contractAddress) {
      setError(
        selectedNetwork === "local"
          ? "Demo contract is still starting on the backend. Try again in a few seconds."
          : "Missing NEXT_PUBLIC_CONTRACT_ADDRESS"
      );
      return;
    }

    if (!isElectionLive(election, getCurrentUnixTime())) {
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
    setManualDemoNetworkInstructions(null);

    try {
      await ensureWalletOnSelectedNetwork();
      const hash = await writeContractAsync({
        chainId: targetChainId,
        address: contractAddress,
        abi: votingAbi,
        functionName: "vote",
        args: [BigInt(election.id), BigInt(candidateId)],
      });

      await waitForTransactionReceipt(wagmiConfig, { chainId: targetChainId, hash });
      setMessage(`Vote confirmed for election #${election.id} on ${activeNetwork.label}.`);
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

  async function deleteElection(election: Election) {
    const confirmed = window.confirm(
      `Delete election "${election.title}" from the dashboard? This hides it from the app UI but does not erase it from the blockchain.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingElectionId(election.id);
    setError("");
    setMessage("");

    try {
      const response = await api.deleteElection(election.id);
      setMessage(response.message);
      const refreshed = await api.listElections();
      setElections(refreshed.elections);
    } catch (deletionError) {
      setError(deletionError instanceof Error ? deletionError.message : "Unable to delete election");
    } finally {
      setDeletingElectionId(null);
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
        <p className="message">
          Active network: <strong>{activeNetwork.label}</strong>
          {isDemoMode ? " with free demo ETH for verified wallets." : " using the live Amoy deployment."}
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
                onClick={() => connect({ chainId: targetChainId, connector })}
                disabled={walletBusy}
              >
                {walletBusy ? "Connecting..." : `Connect ${getConnectorLabel(connector.id, connector.name)}`}
              </button>
            ))}
          </div>
          <p className="muted">
            {selectedNetwork === "local"
              ? `Your wallet will be prompted to add or switch to Demo Hardhat (${targetChainId}). If a WalletConnect mobile wallet refuses the custom chain handoff, the manual network details will appear below.`
              : `Your wallet should be on Polygon Amoy (${targetChainId}).`}
          </p>
        </div>
      ) : null}

      {isConnected && connectedChainId !== targetChainId ? (
        <p className="message error">
          Wallet connected to chain {connectedChainId}. Switch to {activeNetwork.label} before voting.
        </p>
      ) : null}

      {loading ? <p className="message">Loading elections...</p> : null}
      {message ? <p className="message success">{message}</p> : null}
      {error ? <p className="message error">{error}</p> : null}
      {manualDemoNetworkInstructions ? (
        <div className="panel">
          <p className="eyebrow">Manual Demo Network Setup</p>
          <h2>Add Demo Hardhat in your wallet</h2>
          <p className="muted">
            Some mobile wallets connected through WalletConnect will not approve a custom chain switch from the browser.
            Add this network manually, reconnect if your wallet asks you to, then try voting again.
          </p>
          <div className="info-card">
            <strong>Network Name</strong>
            <span className="mono-callout">{manualDemoNetworkInstructions.networkName}</span>
            <strong>RPC URL</strong>
            <span className="mono-callout">{manualDemoNetworkInstructions.rpcUrl}</span>
            <strong>Chain ID</strong>
            <span className="mono-callout">{manualDemoNetworkInstructions.chainId}</span>
            <strong>Currency Symbol</strong>
            <span className="mono-callout">{manualDemoNetworkInstructions.currencySymbol}</span>
          </div>
        </div>
      ) : null}

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
            const voteButtonDisabled = walletBusy || !votingOpen || alreadyVoted;
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
                    {walletBusy
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
                  <div className="stack-sm">
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
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => deleteElection(election)}
                      disabled={deletingElectionId === election.id}
                    >
                      {deletingElectionId === election.id ? "Deleting election..." : "Delete election"}
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
