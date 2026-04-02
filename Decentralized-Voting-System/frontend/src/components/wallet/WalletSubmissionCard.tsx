"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { api } from "../../lib/api";
import { chainByAppNetwork } from "../../lib/wagmi";
import type { User } from "../../lib/types";
import { useAppNetwork } from "../../providers/network-provider";

export function WalletSubmissionCard() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { selectedNetwork } = useAppNetwork();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const targetChainId = chainByAppNetwork[selectedNetwork].id;
  const availableConnectors = useMemo(() => connectors.filter((connector) => connector.id !== "mock"), [connectors]);
  const isVerified = user?.verificationStatus === "verified";
  const normalizedConnectedAddress = address?.toLowerCase();
  const approvedWalletMatchesConnectedWallet =
    Boolean(user?.walletAddress) &&
    Boolean(normalizedConnectedAddress) &&
    user?.walletAddress === normalizedConnectedAddress;

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
    let active = true;

    api
      .me()
      .then((currentUser) => {
        if (!active) {
          return;
        }

        setUser(currentUser);
        if (currentUser.verificationStatus === "verified") {
          setMessage("Wallet already connected and verified. No further submission is needed.");
        }
      })
      .catch((currentError) => {
        if (active) {
          setError(currentError instanceof Error ? currentError.message : "Login required");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingUser(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmitWallet() {
    if (!address) {
      setError("Connect your wallet first");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await api.submitWallet(address);
      setUser(response.user);
      setMessage(response.message);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit wallet");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <p className="eyebrow">Wallet Verification</p>
      <h1>{isVerified ? "Wallet already connected and verified" : "Link the wallet you will use to vote"}</h1>
      <p className="muted">
        {isVerified
          ? "This page now works as a status view for verified users. You can confirm the approved wallet address here at any time."
          : "The admin whitelist process uses this public address and your selected campus role. Only verified wallets can vote on-chain."}
      </p>

      {loadingUser ? <p className="message">Loading your account...</p> : null}

      {user ? (
        <div className="info-card">
          <strong>{user.fullName}</strong>
          <span>{user.role.toUpperCase()}</span>
          <span>Status: {user.verificationStatus.replace("_", " ")}</span>
          {user.walletAddress ? <span>Current wallet: {user.walletAddress}</span> : null}
        </div>
      ) : null}

      <div className="stack-md">
        {message ? <p className="message success">{message}</p> : null}
        {isVerified ? (
          <>
            {isConnected ? (
              <div className="info-card">
                <strong>Connected wallet</strong>
                <span>{address}</span>
                <button className="button secondary" type="button" onClick={() => disconnect()}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="stack-md">
                {availableConnectors.map((connector) => (
                  <button
                    className="button secondary"
                    key={connector.uid}
                    type="button"
                    onClick={() => connect({ chainId: targetChainId, connector })}
                    disabled={isPending}
                  >
                    {isPending
                      ? "Connecting..."
                      : `Connect ${getConnectorLabel(connector.id, connector.name)} to compare`}
                  </button>
                ))}
              </div>
            )}

            {isConnected && !approvedWalletMatchesConnectedWallet ? (
              <p className="message error">
                The currently connected wallet does not match the verified wallet on file. Use the approved wallet when
                voting.
              </p>
            ) : null}

            {isConnected && approvedWalletMatchesConnectedWallet ? (
              <p className="message success">The connected wallet matches the verified wallet on file.</p>
            ) : null}
          </>
        ) : (
          <>
            {!isConnected ? (
              <div className="stack-md">
                {availableConnectors.map((connector) => (
                  <button
                    className="button"
                    key={connector.uid}
                    type="button"
                    onClick={() => connect({ chainId: targetChainId, connector })}
                    disabled={isPending}
                  >
                    {isPending ? "Connecting..." : `Connect ${getConnectorLabel(connector.id, connector.name)}`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="info-card">
                <strong>Connected wallet</strong>
                <span>{address}</span>
                <button className="button secondary" type="button" onClick={() => disconnect()}>
                  Disconnect
                </button>
              </div>
            )}

            <button className="button" type="button" onClick={handleSubmitWallet} disabled={!isConnected || submitting}>
              {submitting ? "Submitting wallet..." : "Submit wallet for verification"}
            </button>
          </>
        )}

        {error ? <p className="message error">{error}</p> : null}
      </div>
    </div>
  );
}
