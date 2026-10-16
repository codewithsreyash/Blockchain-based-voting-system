"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { api } from "../../lib/api";
import { chainByAppNetwork } from "../../lib/wagmi";
import type { User } from "../../lib/types";
import { useAppNetwork } from "../../providers/network-provider";

export function WalletSubmissionCard() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { activeNetwork, selectedNetwork } = useAppNetwork();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const targetChainId = chainByAppNetwork[selectedNetwork].id;
  const availableConnectors = useMemo(
    () => connectors.filter((connector) => connector.id !== "mock"),
    [connectors]
  );
  const isVerified = user?.verificationStatus === "verified";
  const normalizedConnectedAddress = address?.toLowerCase();
  const approvedWalletMatchesConnectedWallet =
    Boolean(user?.walletAddress) &&
    Boolean(normalizedConnectedAddress) &&
    user?.walletAddress?.toLowerCase() === normalizedConnectedAddress;

  function copyAddress(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function getConnectorLabel(connectorId: string, connectorName: string) {
    if (connectorId === "walletConnect") return "WalletConnect (Mobile / QR)";
    if (connectorId === "injected") return "MetaMask / Browser Extension";
    return connectorName;
  }

  useEffect(() => {
    let active = true;

    api
      .me()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        if (currentUser.verificationStatus === "verified") {
          setMessage("Wallet verified on-chain. You are authorized to vote in active elections.");
        }
      })
      .catch((currentError) => {
        if (active) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : "Institutional login required to access wallet verification."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingUser(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmitWallet() {
    if (!address) {
      setError("Please connect your wallet first.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await api.submitWallet(address);
      setUser(response.user);
      setMessage(response.message || "Wallet submitted successfully. Admin review in progress.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to submit wallet.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: "760px", margin: "0 auto" }}>
      {/* Eyebrow & Status */}
      <div className="row-between">
        <div className="eyebrow">
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>account_balance_wallet</span>
          <span>Cryptographic Keypair Binding · Stage 2</span>
        </div>
        <span className={`badge ${isVerified ? "badge-verified" : "badge-pending"}`}>
          {isVerified ? "ON-CHAIN WHITELISTS ACTIVE" : "AUTHENTICATION VERIFIED"}
        </span>
      </div>

      <div className="panel-header">
        <h1 className="panel-title">
          {isVerified ? "Verified Voter Terminal" : "Link your on-chain voting address"}
        </h1>
        <p className="panel-subtitle">
          {isVerified
            ? "Your identity and Ethereum keypair are officially whitelisted on-chain. You can view your credentials or switch accounts below."
            : "Connect your MetaMask or hardware wallet. Your public key will be registered with university election officials and whitelisted in the voting contract."}
        </p>
      </div>

      {loadingUser ? (
        <div className="telemetry-box">
          <div className="telemetry-icon-wrap" style={{ background: "var(--surface-container)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>sync</span>
          </div>
          <div className="telemetry-content">
            <span className="telemetry-title">Retrieving institutional profile...</span>
            <span className="telemetry-desc">Looking up credential status in academic database</span>
          </div>
        </div>
      ) : null}

      {/* User Institutional Profile Card */}
      {user && (
        <div
          style={{
            padding: "20px 24px",
            background: "var(--surface-low)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div className="row-between">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "var(--primary-fixed)",
                  color: "var(--on-primary-fixed)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                {user.fullName?.charAt(0) || "U"}
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem" }}>{user.fullName}</h3>
                <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>{user.email}</span>
              </div>
            </div>
            <span className={`badge badge-${user.role}`}>{user.role.toUpperCase()}</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "10px",
              paddingTop: "10px",
              borderTop: "1px solid var(--border-hairline)",
              fontSize: "13px",
            }}
          >
            <div>
              <span style={{ color: "var(--ink-muted)", display: "block" }}>Verification Status:</span>
              <strong style={{ color: isVerified ? "var(--secondary-emerald)" : "#b45309" }}>
                {user.verificationStatus === "verified"
                  ? "Approved on Chain"
                  : user.verificationStatus === "pending"
                  ? "Pending Admin Whitelist"
                  : "Awaiting Wallet Submission"}
              </strong>
            </div>
            <div>
              <span style={{ color: "var(--ink-muted)", display: "block" }}>Target Network:</span>
              <strong style={{ fontFamily: "var(--font-code)" }}>{activeNetwork.label}</strong>
            </div>
            {user.walletAddress && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "var(--ink-muted)", display: "block" }}>Whitelisted Address on File:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                  <code style={{ fontFamily: "var(--font-code)", fontSize: "12px", color: "var(--primary-amber)" }}>
                    {user.walletAddress}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyAddress(user.walletAddress!)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}
                    title="Copy address"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      {copied ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connected Wallet Section */}
      <div className="stack-md">
        {isConnected && address ? (
          <div
            style={{
              padding: "18px 22px",
              background: "var(--surface)",
              border: "1.5px solid var(--border-card)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-xs)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div className="row-between">
              <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--ink-muted)" }}>
                Active Web3 Client
              </span>
              <button
                className="button secondary sm"
                type="button"
                onClick={() => disconnect()}
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Disconnect
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="pulse-dot"></span>
              <code style={{ fontFamily: "var(--font-code)", fontSize: "13px", fontWeight: 600 }}>
                {address}
              </code>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--ink-muted)" }}>
              Select EVM Wallet Provider
            </span>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {availableConnectors.map((connector) => (
                <button
                  key={connector.uid}
                  className="button secondary"
                  type="button"
                  onClick={() => connect({ chainId: targetChainId, connector })}
                  disabled={isPending}
                  style={{ padding: "14px", justifyContent: "flex-start", gap: "12px" }}
                >
                  <span className="material-symbols-outlined" style={{ color: "var(--primary-amber)" }}>
                    account_balance_wallet
                  </span>
                  <span>{getConnectorLabel(connector.id, connector.name)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Verification Status Feedback Alerts */}
        {isConnected && user && isVerified && !approvedWalletMatchesConnectedWallet ? (
          <div className="message error">
            <span className="material-symbols-outlined">warning</span>
            <span>
              Connected wallet (<code>{address?.slice(0, 8)}...</code>) does not match the verified address on file (<code>{user.walletAddress?.slice(0, 8)}...</code>). Switch to your verified account to vote.
            </span>
          </div>
        ) : null}

        {isConnected && user && isVerified && approvedWalletMatchesConnectedWallet ? (
          <div className="message success">
            <span className="material-symbols-outlined">verified</span>
            <span>
              Connected wallet is verified and whitelisted. You are ready to vote on all active campus ballots!
            </span>
          </div>
        ) : null}

        {message && (
          <div className="message success">
            <span className="material-symbols-outlined">info</span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="message error">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        {!isVerified && (
          <button
            className="button"
            type="button"
            onClick={handleSubmitWallet}
            disabled={!isConnected || submitting}
            style={{ width: "100%", padding: "14px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              {submitting ? "sync" : "send"}
            </span>
            <span>{submitting ? "Submitting Public Address..." : "Submit Wallet for Admin Whitelist"}</span>
          </button>
        )}

        {isVerified && (
          <Link className="button emerald" href="/elections" style={{ width: "100%", padding: "14px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>how_to_vote</span>
            <span>Proceed to Active Elections</span>
          </Link>
        )}
      </div>
    </div>
  );
}
