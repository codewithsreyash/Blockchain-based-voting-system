"use client";

import { useState } from "react";
import type { User } from "../../lib/types";

interface PendingVerificationTableProps {
  title: string;
  users: User[];
  verifyingUserId: string | null;
  onVerify: (userId: string) => Promise<void>;
}

function truncateAddress(address?: string) {
  if (!address) return "Not submitted";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function PendingVerificationTable({
  title,
  users,
  verifyingUserId,
  onVerify,
}: PendingVerificationTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyToClipboard(userId: string, text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="panel">
      <div className="row-between">
        <div>
          <p className="eyebrow">{title} Registry</p>
          <h2>Pending Identity Verifications ({users.length})</h2>
        </div>
        <span className="badge" style={{ background: "var(--surface-container)" }}>
          {title.toUpperCase()} DIVISION
        </span>
      </div>

      {users.length === 0 ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-muted)", fontSize: "14px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "32px", display: "block", margin: "0 auto 8px" }}>
            check_circle
          </span>
          All submitted {title.toLowerCase()} wallets have been verified and whitelisted on-chain.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Voter Name</th>
                <th>Institutional Email</th>
                <th>Campus Credential ID</th>
                <th>Public Wallet Key</th>
                <th style={{ textAlign: "right" }}>Contract Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--primary-amber)" }}>
                        {user.role === "student" ? "school" : "history_edu"}
                      </span>
                      <strong>{user.fullName}</strong>
                    </div>
                  </td>
                  <td style={{ color: "var(--ink-secondary)" }}>{user.email}</td>
                  <td>
                    <span className="badge" style={{ background: "var(--surface-low)", border: "1px solid var(--border-hairline)" }}>
                      {user.studentId || user.employeeId || user.department || "Verified"}
                    </span>
                  </td>
                  <td>
                    {user.walletAddress ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <code className="mono-cell" title={user.walletAddress}>
                          {truncateAddress(user.walletAddress)}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(user._id, user.walletAddress!)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}
                          title="Copy address"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                            {copiedId === user._id ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "var(--ink-muted)", fontStyle: "italic", fontSize: "12px" }}>
                        Awaiting Wallet Link
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="button sm"
                      type="button"
                      onClick={() => onVerify(user._id)}
                      disabled={verifyingUserId === user._id || !user.walletAddress}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                        {verifyingUserId === user._id ? "sync" : "verified_user"}
                      </span>
                      <span>{verifyingUserId === user._id ? "Whitelisting..." : "Whitelist on Chain"}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
