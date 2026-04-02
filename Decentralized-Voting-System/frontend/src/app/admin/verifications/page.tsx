"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PendingVerificationTable } from "../../../components/admin/PendingVerificationTable";
import { api } from "../../../lib/api";
import type { User } from "../../../lib/types";

export default function AdminVerificationsPage() {
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
      setStudents(response.students);
      setTeachers(response.teachers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load verifications");
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
      setMessage(`Wallet verified on-chain. Tx: ${response.transactionHash}`);
      await loadQueue();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to verify user");
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
        `Verified ${response.verifiedCount} users across ${response.transactionHashes.length} blockchain batch(es).`
      );
      await loadQueue();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to verify all users");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="stack-xl">
      <div className="panel hero-panel">
        <p className="eyebrow">Admin Verification</p>
        <h1>Approve pending student and teacher wallets</h1>
        <p className="muted">
          Clicking verify writes the approved address and role to the whitelist contract through the backend admin signer.
        </p>
        <div className="row-between">
          <button className="button" type="button" onClick={handleVerifyAll} disabled={bulkLoading}>
            {bulkLoading ? "Verifying all..." : "Verify all pending users"}
          </button>
          <Link className="button secondary" href="/admin/elections/new">
            Create election
          </Link>
        </div>
      </div>

      {message ? <p className="message success">{message}</p> : null}
      {error ? <p className="message error">{error}</p> : null}

      <PendingVerificationTable
        title="Students"
        users={students}
        verifyingUserId={verifyingUserId}
        onVerify={handleVerify}
      />

      <PendingVerificationTable
        title="Teachers"
        users={teachers}
        verifyingUserId={verifyingUserId}
        onVerify={handleVerify}
      />
    </div>
  );
}
