"use client";

import { FormEvent, useState } from "react";
import { api } from "../../lib/api";

const emptyCandidate = "";

export function CreateElectionForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eligibleVoters, setEligibleVoters] = useState<"students" | "teachers" | "both">("both");
  const [candidateNames, setCandidateNames] = useState<string[]>([emptyCandidate, emptyCandidate]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateCandidate(index: number, value: string) {
    setCandidateNames((current) =>
      current.map((candidate, candidateIndex) => (candidateIndex === index ? value : candidate))
    );
  }

  function addCandidate() {
    setCandidateNames((current) => (current.length >= 50 ? current : [...current, emptyCandidate]));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const cleanCandidateNames = candidateNames.map((candidate) => candidate.trim()).filter(Boolean);
      const response = await api.createElection({
        title,
        description,
        eligibleVoters,
        candidateNames: cleanCandidateNames,
        startTime,
        endTime,
      });

      setMessage(
        response.electionId
          ? `Election #${response.electionId} created successfully.`
          : "Election created successfully."
      );
      setTitle("");
      setDescription("");
      setEligibleVoters("both");
      setCandidateNames([emptyCandidate, emptyCandidate]);
      setStartTime("");
      setEndTime("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create election");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <p className="eyebrow">Election Composer</p>
      <h1>Create a role-aware election</h1>
      <p className="muted">
        Choose which campus roles are eligible before publishing the election to the contract.
      </p>

      <form className="stack-lg" onSubmit={handleSubmit}>
        <label className="field">
          <span>Election title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} required />
        </label>

        <label className="field">
          <span>Eligible voters</span>
          <select
            value={eligibleVoters}
            onChange={(event) => setEligibleVoters(event.target.value as "students" | "teachers" | "both")}
          >
            <option value="students">Only students</option>
            <option value="teachers">Only teachers</option>
            <option value="both">Both students and teachers</option>
          </select>
        </label>

        <div className="stack-md">
          <div className="row-between">
            <span className="section-label">Candidates</span>
            <button className="button secondary" type="button" onClick={addCandidate} disabled={candidateNames.length >= 50}>
              Add candidate
            </button>
          </div>

          {candidateNames.map((candidateName, index) => (
            <label className="field" key={`candidate-${index}`}>
              <span>Candidate {index + 1}</span>
              <input
                value={candidateName}
                onChange={(event) => updateCandidate(index, event.target.value)}
                placeholder="Candidate name"
                required
              />
            </label>
          ))}
        </div>

        <div className="two-column">
          <label className="field">
            <span>Start time</span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>End time</span>
            <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>
        </div>

        {message ? <p className="message success">{message}</p> : null}
        {error ? <p className="message error">{error}</p> : null}

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "Publishing election..." : "Create election"}
        </button>
      </form>
    </div>
  );
}
