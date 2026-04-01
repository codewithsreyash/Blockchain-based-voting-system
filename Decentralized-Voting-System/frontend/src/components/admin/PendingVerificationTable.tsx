"use client";

import type { User } from "../../lib/types";

interface PendingVerificationTableProps {
  title: string;
  users: User[];
  verifyingUserId: string | null;
  onVerify: (userId: string) => Promise<void>;
}

export function PendingVerificationTable({
  title,
  users,
  verifyingUserId,
  onVerify,
}: PendingVerificationTableProps) {
  return (
    <div className="panel">
      <p className="eyebrow">{title}</p>
      <h2>Pending wallet verifications</h2>

      {users.length === 0 ? (
        <p className="muted">No pending {title.toLowerCase()} verifications.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Campus ID</th>
                <th>Wallet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{user.studentId || user.employeeId || "Unavailable"}</td>
                  <td className="mono-cell">{user.walletAddress}</td>
                  <td>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => onVerify(user._id)}
                      disabled={verifyingUserId === user._id}
                    >
                      {verifyingUserId === user._id ? "Verifying..." : "Verify"}
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
