"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setAuthToken } from "../../lib/api";
import type { UserRole } from "../../lib/types";

type SignupRole = Exclude<UserRole, "admin">;

export function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [major, setMajor] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.signup({
        fullName,
        email,
        password,
        role,
        studentId: role === "student" ? studentId : undefined,
        major: role === "student" ? major : undefined,
        department: role === "teacher" ? department : undefined,
        employeeId: role === "teacher" ? employeeId : undefined,
      });

      setAuthToken(response.token);
      router.push("/wallet");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <p className="eyebrow">Registration</p>
      <h1>Create a voter account</h1>
      <p className="muted">
        Choose the correct campus role so the admin can verify you against the right voter list.
      </p>

      <form className="stack-lg" onSubmit={handleSubmit}>
        <div className="pill-row">
          <button
            type="button"
            className={`pill ${role === "student" ? "active" : ""}`}
            onClick={() => setRole("student")}
          >
            Student
          </button>
          <button
            type="button"
            className={`pill ${role === "teacher" ? "active" : ""}`}
            onClick={() => setRole("teacher")}
          >
            Teacher
          </button>
        </div>

        <label className="field">
          <span>Full name</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@college.edu"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
        </label>

        {role === "student" ? (
          <>
            <label className="field">
              <span>Student ID</span>
              <input value={studentId} onChange={(event) => setStudentId(event.target.value)} required />
            </label>
            <label className="field">
              <span>Major</span>
              <input value={major} onChange={(event) => setMajor(event.target.value)} required />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Department</span>
              <input value={department} onChange={(event) => setDepartment(event.target.value)} required />
            </label>
            <label className="field">
              <span>Employee ID</span>
              <input value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required />
            </label>
          </>
        )}

        {error ? <p className="message error">{error}</p> : null}

        <button className="button" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="muted">
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </div>
  );
}
