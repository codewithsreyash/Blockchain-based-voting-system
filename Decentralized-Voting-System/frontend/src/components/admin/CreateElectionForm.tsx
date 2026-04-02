"use client";

import { FormEvent, useState } from "react";
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
          ? `Election #${response.electionId} created successfully on ${activeNetwork.label}.`
          : `Election created successfully on ${activeNetwork.label}.`
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
    <div className="panel">
      <p className="eyebrow">Election Composer</p>
      <h1>Create a role-aware election</h1>
      <p className="muted">
        Choose which campus roles are eligible before publishing the election to the contract.
      </p>
      <p className="message">
        Publishing to <strong>{activeNetwork.label}</strong>
        {isDemoMode ? " with the backend's free demo signer." : " with the Amoy backend signer."}
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
        {errors.length > 0 ? (
          <div className="stack-sm">
            {errors.map((errorMessage) => (
              <p className="message error" key={errorMessage}>
                {errorMessage}
              </p>
            ))}
          </div>
        ) : null}

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "Publishing election..." : "Create election"}
        </button>
      </form>
    </div>
  );
}
