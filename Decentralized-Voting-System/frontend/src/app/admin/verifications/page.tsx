"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PendingVerificationTable } from "../../../components/admin/PendingVerificationTable";
import { api } from "../../../lib/api";
import type { User } from "../../../lib/types";
import { useAppNetwork } from "../../../providers/network-provider";

export default function AdminVerificationsPage() {
  const { activeNetwork, isDemoMode } = useAppNetwork();
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setError("");

    try {
      const response = await api.getPendingVerifications();
      setStudents(response.students || []);
      setTeachers(response.teachers || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load verification queue. Please verify your administrative credentials."
      );
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function handleVerify(userId: string) {
    setVerifyingUserId(userId);
    setMessage("");
    setError("");

    try {
      const response = await api.verifyUser(userId);
      setMessage(`Wallet successfully whitelisted on ${activeNetwork.label}! Tx Hash: ${response.transactionHash}`);
      await loadQueue();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to verify voter on-chain.");
    } finally {
      setVerifyingUserId(null);
    }
  }

  async function handleVerifyAll() {
    setBulkLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.verifyAll();
      setMessage(
        `Successfully whitelisted ${response.verifiedCount} voter(s) on ${activeNetwork.label} across ${response.transactionHashes.length} gas-safe transaction batch(es).`
      );
      await loadQueue();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to complete batch verification.");
    } finally {
      setBulkLoading(false);
    }
  }

  const totalPending = students.length + teachers.length;

  return (
    <div className="stack-xl">
      {/* Admin Command Center Hero */}
      <div className="panel hero-panel">
        <div className="row-between">
          <div className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>admin_panel_settings</span>
            <span>Election Commissioner · Authorization Terminal</span>
          </div>
          <span className="badge badge-admin">DELEGATE CONSOLE</span>
        </div>

        <div className="panel-header">
          <h1 className="panel-title">Institutional Voter Whitelist Console</h1>
          <p className="panel-subtitle">
            Review student and faculty credentials submitted through institutional authentication. Approving voters submits cryptographic role proofs to the Solidity smart contract.
          </p>
        </div>

        {/* Telemetry Stat Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
            padding: "16px",
            background: "var(--surface-low)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-hairline)",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
              Pending Students
            </span>
            <h2 style={{ color: "#1e3a8a", marginTop: "2px" }}>{students.length}</h2>
          </div>

          <div>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
              Pending Faculty
            </span>
            <h2 style={{ color: "var(--tertiary)", marginTop: "2px" }}>{teachers.length}</h2>
          </div>

          <div>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
              Consensus Target
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
              <span className="pulse-dot"></span>
              <span style={{ fontFamily: "var(--font-code)", fontWeight: 600, fontSize: "13px" }}>
                {activeNetwork.label}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="row-between" style={{ flexWrap: "wrap", gap: "12px", paddingTop: "8px" }}>
          <button
            className="button emerald"
            type="button"
            onClick={handleVerifyAll}
            disabled={bulkLoading || totalPending === 0}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              {bulkLoading ? "sync" : "checklist_rtl"}
            </span>
            <span>{bulkLoading ? "Writing Batches to Chain..." : `Batch Whitelist All (${totalPending})`}</span>
          </button>

          <Link className="button" href="/admin/elections/new">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_circle</span>
            <span>Create New Election</span>
          </Link>
        </div>
      </div>

      {message && (
        <div className="message success">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="message error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Verification Tables */}
      <PendingVerificationTable
        title="Student Voters"
        users={students}
        verifyingUserId={verifyingUserId}
        onVerify={handleVerify}
      />

      <PendingVerificationTable
        title="Faculty Members"
        users={teachers}
        verifyingUserId={verifyingUserId}
        onVerify={handleVerify}
      />
    </div>
  );
}
