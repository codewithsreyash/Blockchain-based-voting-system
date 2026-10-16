"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { ElectionResults } from "../../lib/types";
import { useAppNetwork } from "../../providers/network-provider";

function toReadableDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercentage(percentage: number) {
  return `${percentage.toFixed(1)}%`;
}

export function ElectionResultsView() {
  const params = useParams<{ electionId: string }>();
  const electionId = Number(params.electionId);
  const { activeNetwork, selectedNetwork } = useAppNetwork();
  const [results, setResults] = useState<ElectionResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(electionId) || electionId <= 0) {
      setError("Invalid election id");
      setLoading(false);
      return;
    }

    let active = true;

    api
      .getElectionResults(electionId)
      .then((response) => {
        if (active) setResults(response);
      })
      .catch((resultsError) => {
        if (active) {
          setError(resultsError instanceof Error ? resultsError.message : "Unable to load election results");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [electionId, selectedNetwork]);

  const winnerSummary =
    !results || results.totalVotes === 0
      ? "No votes were cast in this election."
      : results.hasTie
      ? `Tie between ${results.winners.map((candidate) => candidate.name).join(", ")}`
      : `Winner: ${results.winners[0]?.name}`;

  return (
    <div className="stack-xl">
      <div className="row-between">
        <Link className="button secondary sm" href="/elections">
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_back</span>
          <span>Back to Elections Feed</span>
        </Link>
        <span className="eyebrow">Cryptographic Tally Audit</span>
      </div>

      {loading && (
        <section className="panel">
          <div className="eyebrow">Auditing Smart Contract</div>
          <h2>Loading election tally...</h2>
          <p style={{ color: "var(--ink-muted)" }}>Reading immutable vote counts from {activeNetwork.label}...</p>
        </section>
      )}

      {!loading && error && (
        <section className="panel">
          <div className="eyebrow">Audit Status</div>
          <h2>Results Unavailable</h2>
          <div className="message error">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
          <p style={{ color: "var(--ink-muted)", fontSize: "14px" }}>
            Official results are published after the election voting window has closed.
          </p>
        </section>
      )}

      {!loading && results && (
        <>
          <section className="panel hero-panel">
            <div className="row-between">
              <span className="eyebrow">Official Ballot #{results.election.id} Result</span>
              <span className="badge badge-verified">ON-CHAIN CONSENSUS VERIFIED</span>
            </div>

            <h1 style={{ fontSize: "2.2rem" }}>{results.election.title}</h1>
            <p style={{ color: "var(--ink-secondary)", fontSize: "15px" }}>{results.election.description}</p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                padding: "16px",
                background: "var(--surface-low)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-hairline)",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
                  Total Ballots Cast
                </span>
                <h2 style={{ color: "var(--primary-amber)", marginTop: "2px" }}>{results.totalVotes}</h2>
              </div>
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
                  Eligible Roles
                </span>
                <h2 style={{ fontSize: "1.3rem", marginTop: "4px" }}>{results.election.eligibleVoters.toUpperCase()}</h2>
              </div>
              <div>
                <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 700 }}>
                  Audit Network
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                  <span className="pulse-dot"></span>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: "13px", fontWeight: 600 }}>
                    {activeNetwork.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="message success">
              <span className="material-symbols-outlined">emoji_events</span>
              <strong>{winnerSummary}</strong>
            </div>
          </section>

          <section className="panel stack-lg">
            <div className="row-between">
              <div>
                <p className="eyebrow">Candidate Standings</p>
                <h2>Official Candidate Breakdown</h2>
              </div>
              <span className="badge" style={{ background: "var(--surface-container)" }}>
                {results.totalVotes === 0 ? "NO VOTES" : results.hasTie ? "TIE TALLY" : "DECISIVE QUORUM"}
              </span>
            </div>

            <div className="stack-md">
              {results.candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  style={{
                    padding: "18px 22px",
                    background: candidate.isWinner ? "var(--secondary-light)" : "var(--surface-low)",
                    border: `1.5px solid ${candidate.isWinner ? "var(--secondary-container)" : "var(--border-hairline)"}`,
                    borderRadius: "var(--radius-lg)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div className="row-between">
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ fontSize: "1.2rem" }}>{candidate.name}</h3>
                        {candidate.isWinner && (
                          <span className="badge badge-verified" style={{ fontSize: "10px" }}>
                            WINNER
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>
                        Candidate ID #{candidate.id}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "1.2rem", fontFamily: "var(--font-code)" }}>
                        {candidate.voteCount} votes
                      </strong>
                      <span style={{ display: "block", fontSize: "12px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>
                        {formatPercentage(candidate.percentage)}
                      </span>
                    </div>
                  </div>

                  {/* Visual vote percentage progress bar */}
                  <div style={{ width: "100%", height: "8px", background: "var(--surface-container)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${candidate.percentage}%`,
                        background: candidate.isWinner ? "var(--secondary-emerald)" : "var(--primary-amber)",
                        borderRadius: "var(--radius-full)",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
