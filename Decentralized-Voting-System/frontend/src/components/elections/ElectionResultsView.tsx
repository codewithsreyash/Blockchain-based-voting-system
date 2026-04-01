"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { ElectionResults } from "../../lib/types";

function toReadableDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function formatPercentage(percentage: number) {
  return `${percentage.toFixed(1)}%`;
}

export function ElectionResultsView() {
  const params = useParams<{ electionId: string }>();
  const electionId = Number(params.electionId);
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
        if (active) {
          setResults(response);
        }
      })
      .catch((resultsError) => {
        if (active) {
          setError(resultsError instanceof Error ? resultsError.message : "Unable to load election results");
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
  }, [electionId]);

  const winnerSummary =
    !results || results.totalVotes === 0
      ? "No votes were cast in this election."
      : results.hasTie
        ? `Tie between ${results.winners.map((candidate) => candidate.name).join(", ")}`
        : `Winner: ${results.winners[0]?.name}`;

  return (
    <div className="stack-xl">
      <Link className="nav-link back-link" href="/elections">
        Back to Elections
      </Link>

      {loading ? (
        <section className="panel">
          <p className="eyebrow">Results Dashboard</p>
          <h1>Loading final tally...</h1>
          <p className="muted">Fetching the official candidate counts from the blockchain.</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <p className="eyebrow">Results Dashboard</p>
          <h1>Results unavailable</h1>
          <p className="message error">{error}</p>
          <p className="muted">Results are only released after the election has fully closed.</p>
        </section>
      ) : null}

      {!loading && results ? (
        <>
          <section className="panel hero-panel">
            <p className="eyebrow">Final Results</p>
            <h1>{results.election.title}</h1>
            <p className="muted">{results.election.description}</p>

            <div className="stats-grid">
              <div className="info-card">
                <span>Total Votes</span>
                <strong>{results.totalVotes}</strong>
              </div>
              <div className="info-card">
                <span>Eligible Voters</span>
                <strong>{results.election.eligibleVoters}</strong>
              </div>
              <div className="info-card">
                <span>Voting Window</span>
                <strong>{`${toReadableDate(results.election.startTime)} to ${toReadableDate(results.election.endTime)}`}</strong>
              </div>
            </div>

            <p className={`message ${results.totalVotes > 0 ? "success" : ""}`}>{winnerSummary}</p>
          </section>

          <section className="panel stack-lg">
            <div className="row-between">
              <div>
                <p className="eyebrow">Candidate Breakdown</p>
                <h2>Official blockchain tally</h2>
              </div>
              <span className={`state-chip ${results.hasTie ? "upcoming" : "live"}`}>
                {results.totalVotes === 0 ? "No Votes" : results.hasTie ? "Tie" : "Winner Decided"}
              </span>
            </div>

            <div className="stack-md">
              {results.candidates.map((candidate) => (
                <article className={`result-card ${candidate.isWinner ? "winner" : ""}`} key={candidate.id}>
                  <div className="row-between">
                    <div>
                      <h2>{candidate.name}</h2>
                      <p className="muted">{candidate.isWinner ? "Winning position" : "Final standing"}</p>
                    </div>
                    <div className="result-metrics">
                      <strong>{candidate.voteCount} votes</strong>
                      <span className="muted">{formatPercentage(candidate.percentage)}</span>
                    </div>
                  </div>

                  <div className="result-bar" aria-hidden="true">
                    <div
                      className={`result-bar-fill ${candidate.isWinner ? "winner" : ""}`}
                      style={{ width: `${candidate.percentage}%` }}
                    />
                  </div>

                  {candidate.isWinner ? (
                    <p className="message success">{results.hasTie ? "Tie winner" : "Election winner"}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
