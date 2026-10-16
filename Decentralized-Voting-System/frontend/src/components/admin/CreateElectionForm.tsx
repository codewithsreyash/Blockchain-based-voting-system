"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "../../lib/api";
import { useAppNetwork } from "../../providers/network-provider";

const emptyCandidate = "";
const minimumTitleLength = 3;
const minimumDescriptionLength = 10;

function toAbsoluteIsoString(localDateTime: string) {
  const parsedDate = new Date(localDateTime);
  if (!Number.isFinite(parsedDate.getTime())) {
    return null;
  }
  return parsedDate.toISOString();
}

function getCreateElectionValidationMessages({
  title,
  description,
  candidateNames,
  startTime,
  endTime,
}: {
  title: string;
  description: string;
  candidateNames: string[];
  startTime: string;
  endTime: string;
}) {
  const messages: string[] = [];
  const parsedStartTime = new Date(startTime);
  const parsedEndTime = new Date(endTime);
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();
  const validCandidateCount = candidateNames.filter((candidate) => candidate.trim().length > 0).length;
  const emptyCandidateCount = candidateNames.filter((candidate) => candidate.trim().length === 0).length;

  if (normalizedTitle.length < minimumTitleLength) {
    messages.push(`Title must be at least ${minimumTitleLength} characters long`);
  }

  if (normalizedDescription.length < minimumDescriptionLength) {
    messages.push(`Description must be at least ${minimumDescriptionLength} characters long`);
  }

  if (validCandidateCount < 2) {
    messages.push("At least two candidate names are required");
  }

  if (emptyCandidateCount > 0) {
    messages.push("Candidate names cannot be empty");
  }

  if (!Number.isFinite(parsedStartTime.getTime())) {
    messages.push("Start time must be a valid date and time");
  }

  if (!Number.isFinite(parsedEndTime.getTime())) {
    messages.push("End time must be a valid date and time");
  }

  if (Number.isFinite(parsedStartTime.getTime()) && parsedStartTime.getTime() <= Date.now()) {
    messages.push("Start time must be in the future");
  }

  if (
    Number.isFinite(parsedStartTime.getTime()) &&
    Number.isFinite(parsedEndTime.getTime()) &&
    parsedEndTime <= parsedStartTime
  ) {
    messages.push("End time must be after start time");
  }

  return Array.from(new Set(messages));
}

function getSubmissionErrors(error: unknown) {
  if (error instanceof ApiError && error.details) {
    const fieldErrors = Object.values(error.details.fieldErrors ?? {}).flat().filter(Boolean) as string[];
    const formErrors = (error.details.formErrors ?? []).filter(Boolean);
    const errors = Array.from(new Set([...formErrors, ...fieldErrors]));

    if (errors.length > 0) {
      return errors;
    }
  }

  if (error instanceof Error && error.message) {
    return [error.message];
  }

  return ["Unable to create election"];
}

export function CreateElectionForm() {
  const { activeNetwork, isDemoMode } = useAppNetwork();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eligibleVoters, setEligibleVoters] = useState<"students" | "teachers" | "both">("both");
  const [candidateNames, setCandidateNames] = useState<string[]>([emptyCandidate, emptyCandidate]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function updateCandidate(index: number, value: string) {
    setCandidateNames((current) =>
      current.map((candidate, candidateIndex) => (candidateIndex === index ? value : candidate))
    );
  }

  function addCandidate() {
    setCandidateNames((current) => (current.length >= 50 ? current : [...current, emptyCandidate]));
  }

  function removeCandidate(index: number) {
    if (candidateNames.length <= 2) return;
    setCandidateNames((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setErrors([]);

    try {
      const cleanCandidateNames = candidateNames.map((candidate) => candidate.trim()).filter(Boolean);
      const startTimeIso = toAbsoluteIsoString(startTime);
      const endTimeIso = toAbsoluteIsoString(endTime);
      const validationMessages = getCreateElectionValidationMessages({
        title,
        description,
        candidateNames,
        startTime,
        endTime,
      });

      if (validationMessages.length > 0) {
        setErrors(validationMessages);
        return;
      }

      const response = await api.createElection({
        title: title.trim(),
        description: description.trim(),
        eligibleVoters,
        candidateNames: cleanCandidateNames,
        startTime: startTimeIso ?? startTime,
        endTime: endTimeIso ?? endTime,
      });

      setMessage(
        response.electionId
          ? `Election #${response.electionId} created successfully on ${activeNetwork.label}!`
          : `Election created and published on ${activeNetwork.label}!`
      );
      setTitle("");
      setDescription("");
      setEligibleVoters("both");
      setCandidateNames([emptyCandidate, emptyCandidate]);
      setStartTime("");
      setEndTime("");
      setErrors([]);
    } catch (submissionError) {
      setErrors(getSubmissionErrors(submissionError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: "780px", margin: "0 auto" }}>
      {/* Eyebrow */}
      <div className="row-between">
        <div className="eyebrow">
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>add_task</span>
          <span>Ballot Composer · On-Chain Governance</span>
        </div>
        <Link className="button secondary sm" href="/admin/verifications">
          <span>Back to Verifications</span>
        </Link>
      </div>

      <div className="panel-header">
        <h1 className="panel-title">Publish a role-restricted election</h1>
        <p className="panel-subtitle">
          Specify eligible collegiate constituencies before submitting the proposal to the smart contract. Rules are immutably enforced on-chain.
        </p>
      </div>

      <div className="telemetry-box">
        <div className="telemetry-icon-wrap" style={{ background: "var(--primary-fixed)", color: "var(--on-primary-fixed)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>token</span>
        </div>
        <div className="telemetry-content">
          <span className="telemetry-title">Publishing Target: {activeNetwork.label}</span>
          <span className="telemetry-desc">
            {isDemoMode
              ? "Free demo signer deploy directly into embedded Hardhat RPC"
              : "Amoy backend signer writes election configuration into verified contract"}
          </span>
        </div>
      </div>

      <form className="stack-lg" onSubmit={handleSubmit}>
        {/* Title */}
        <div className="field">
          <label htmlFor="electionTitle">Election Title</label>
          <div className="input-container">
            <span className="material-symbols-outlined input-icon">edit</span>
            <input
              id="electionTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Student Union Executive Council 2026–2027"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div className="field">
          <label htmlFor="electionDesc">Election Description &amp; Constitutional Charter</label>
          <textarea
            id="electionDesc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Outline the governance mandates, quorum requirements, and key voting rules..."
            rows={4}
            required
          />
        </div>

        {/* Role Eligibility Selector */}
        <div className="field">
          <label>Eligible Constituency</label>
          <div className="role-switcher-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <button
              type="button"
              className={`role-tab-btn ${eligibleVoters === "students" ? "active" : ""}`}
              onClick={() => setEligibleVoters("students")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>school</span>
              <span>Students Only</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${eligibleVoters === "teachers" ? "active" : ""}`}
              onClick={() => setEligibleVoters("teachers")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>history_edu</span>
              <span>Faculty Only</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${eligibleVoters === "both" ? "active" : ""}`}
              onClick={() => setEligibleVoters("both")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>groups</span>
              <span>All Campus</span>
            </button>
          </div>
        </div>

        {/* Dynamic Candidates List */}
        <div className="stack-md">
          <div className="row-between">
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-primary)" }}>
              Ballot Candidates / Slates ({candidateNames.length})
            </span>
            <button
              className="button secondary sm"
              type="button"
              onClick={addCandidate}
              disabled={candidateNames.length >= 50}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
              <span>Add Candidate</span>
            </button>
          </div>

          {candidateNames.map((candidateName, index) => (
            <div key={`candidate-${index}`} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div className="input-container" style={{ flex: 1 }}>
                <span className="material-symbols-outlined input-icon">person</span>
                <input
                  value={candidateName}
                  onChange={(event) => updateCandidate(index, event.target.value)}
                  placeholder={`Candidate #${index + 1} Slate / Representative Name`}
                  required
                />
              </div>
              {candidateNames.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeCandidate(index)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--danger-red)",
                    padding: "8px",
                  }}
                  title="Remove candidate"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Voting Window */}
        <div className="two-column">
          <div className="field">
            <label htmlFor="startTime">Start Date &amp; Time</label>
            <input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="endTime">End Date &amp; Time</label>
            <input
              id="endTime"
              type="datetime-local"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </div>
        </div>

        {message && (
          <div className="message success">
            <span className="material-symbols-outlined">check_circle</span>
            <span>{message}</span>
          </div>
        )}

        {errors.length > 0 && (
          <div className="stack-sm">
            {errors.map((errorMessage) => (
              <div className="message error" key={errorMessage}>
                <span className="material-symbols-outlined">error</span>
                <span>{errorMessage}</span>
              </div>
            ))}
          </div>
        )}

        <button className="button" type="submit" disabled={submitting} style={{ width: "100%", padding: "14px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            {submitting ? "sync" : "publish"}
          </span>
          <span>{submitting ? "Deploying Ballot to Smart Contract..." : "Deploy Election on Chain"}</span>
        </button>
      </form>
    </div>
  );
}
