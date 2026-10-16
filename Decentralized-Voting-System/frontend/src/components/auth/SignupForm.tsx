"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getApiFieldErrors, getApiFormErrors, setAuthToken } from "../../lib/api";
import type { UserRole } from "../../lib/types";

type SignupRole = Exclude<UserRole, "admin">;
type SignupFieldName = "fullName" | "email" | "password" | "studentId" | "major" | "department" | "employeeId";

export function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [major, setMajor] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignupFieldName, string[]>>>({});
  const [loading, setLoading] = useState(false);

  function clearFieldError(fieldName: SignupFieldName) {
    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  }

  function getFieldErrorMessages(fieldName: SignupFieldName) {
    return fieldErrors[fieldName] ?? [];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormErrors([]);
    setFieldErrors({});

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
      setFormErrors(getApiFormErrors(submissionError, "Unable to create account. Please check your inputs."));
      setFieldErrors(getApiFieldErrors(submissionError) as Partial<Record<SignupFieldName, string[]>>);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: "720px", margin: "0 auto" }}>
      {/* Eyebrow & Status Header */}
      <div className="row-between">
        <div className="eyebrow">
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>how_to_reg</span>
          <span>Credential Registration · Academic Registry</span>
        </div>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", color: "var(--ink-muted)" }}>
          VERIFY-STAGE-1
        </span>
      </div>

      <div className="panel-header">
        <h1 className="panel-title">Create your campus voting identity</h1>
        <p className="panel-subtitle">
          Select your institutional role to populate verifiable academic attributes. After approval, your wallet address is whitelisted on-chain.
        </p>
      </div>

      {/* Role Selector Tabs (Stitch) */}
      <div className="role-switcher-card">
        <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, color: "var(--ink-muted)" }}>
          Select University Role
        </span>
        <div className="role-switcher-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button
            type="button"
            className={`role-tab-btn ${role === "student" ? "active" : ""}`}
            onClick={() => {
              setRole("student");
              setFormErrors([]);
              setFieldErrors({});
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>school</span>
            <span>Student Voter</span>
          </button>

          <button
            type="button"
            className={`role-tab-btn ${role === "teacher" ? "active" : ""}`}
            onClick={() => {
              setRole("teacher");
              setFormErrors([]);
              setFieldErrors({});
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>history_edu</span>
            <span>Faculty / Teacher</span>
          </button>
        </div>
      </div>

      <form className="stack-lg" onSubmit={handleSubmit}>
        <div className="two-column">
          {/* Full Name */}
          <div className="field">
            <label htmlFor="fullName">Full Name</label>
            <div className="input-container">
              <span className="material-symbols-outlined input-icon">person</span>
              <input
                id="fullName"
                type="text"
                placeholder="Maya Lin"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  clearFieldError("fullName");
                }}
                aria-invalid={getFieldErrorMessages("fullName").length > 0}
                required
              />
            </div>
            {getFieldErrorMessages("fullName").map((errorMessage) => (
              <small className="field-error" key={`fullName-${errorMessage}`}>
                {errorMessage}
              </small>
            ))}
          </div>

          {/* Email */}
          <div className="field">
            <label htmlFor="email">Campus Email</label>
            <div className="input-container">
              <span className="material-symbols-outlined input-icon">alternate_email</span>
              <input
                id="email"
                type="email"
                placeholder="maya.lin@university.edu"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                aria-invalid={getFieldErrorMessages("email").length > 0}
                required
              />
            </div>
            {getFieldErrorMessages("email").map((errorMessage) => (
              <small className="field-error" key={`email-${errorMessage}`}>
                {errorMessage}
              </small>
            ))}
          </div>
        </div>

        {/* Password */}
        <div className="field">
          <label htmlFor="password">Institutional Password / Key</label>
          <div className="input-container">
            <span className="material-symbols-outlined input-icon">key</span>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              aria-invalid={getFieldErrorMessages("password").length > 0}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {getFieldErrorMessages("password").map((errorMessage) => (
            <small className="field-error" key={`password-${errorMessage}`}>
              {errorMessage}
            </small>
          ))}
        </div>

        {/* Role-Specific Fields */}
        {role === "student" ? (
          <div className="two-column">
            <div className="field">
              <label htmlFor="studentId">Student ID / Roll No</label>
              <div className="input-container">
                <span className="material-symbols-outlined input-icon">badge</span>
                <input
                  id="studentId"
                  type="text"
                  placeholder="STU-2026-8941"
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value);
                    clearFieldError("studentId");
                  }}
                  aria-invalid={getFieldErrorMessages("studentId").length > 0}
                  required
                />
              </div>
              {getFieldErrorMessages("studentId").map((errorMessage) => (
                <small className="field-error" key={`studentId-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </div>

            <div className="field">
              <label htmlFor="major">Major / Program</label>
              <div className="input-container">
                <span className="material-symbols-outlined input-icon">school</span>
                <input
                  id="major"
                  type="text"
                  placeholder="Computer Science & Governance"
                  value={major}
                  onChange={(event) => {
                    setMajor(event.target.value);
                    clearFieldError("major");
                  }}
                  aria-invalid={getFieldErrorMessages("major").length > 0}
                  required
                />
              </div>
              {getFieldErrorMessages("major").map((errorMessage) => (
                <small className="field-error" key={`major-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </div>
          </div>
        ) : (
          <div className="two-column">
            <div className="field">
              <label htmlFor="department">Academic Department</label>
              <div className="input-container">
                <span className="material-symbols-outlined input-icon">apartment</span>
                <input
                  id="department"
                  type="text"
                  placeholder="Faculty of Engineering & Law"
                  value={department}
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    clearFieldError("department");
                  }}
                  aria-invalid={getFieldErrorMessages("department").length > 0}
                  required
                />
              </div>
              {getFieldErrorMessages("department").map((errorMessage) => (
                <small className="field-error" key={`department-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </div>

            <div className="field">
              <label htmlFor="employeeId">Faculty Employee ID</label>
              <div className="input-container">
                <span className="material-symbols-outlined input-icon">badge</span>
                <input
                  id="employeeId"
                  type="text"
                  placeholder="FAC-2026-102"
                  value={employeeId}
                  onChange={(event) => {
                    setEmployeeId(event.target.value);
                    clearFieldError("employeeId");
                  }}
                  aria-invalid={getFieldErrorMessages("employeeId").length > 0}
                  required
                />
              </div>
              {getFieldErrorMessages("employeeId").map((errorMessage) => (
                <small className="field-error" key={`employeeId-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </div>
          </div>
        )}

        {formErrors.length > 0 && (
          <div className="stack-sm">
            {formErrors.map((errorMessage) => (
              <div className="message error" key={errorMessage}>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
                <span>{errorMessage}</span>
              </div>
            ))}
          </div>
        )}

        <button className="button" type="submit" disabled={loading} style={{ width: "100%", padding: "14px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            {loading ? "sync" : "person_add"}
          </span>
          <span>{loading ? "Submitting Registration..." : "Create Verified Account"}</span>
        </button>
      </form>

      <div className="row-between" style={{ paddingTop: "12px", borderTop: "1px solid var(--border-hairline)" }}>
        <span style={{ color: "var(--ink-secondary)", fontSize: "13px" }}>Already registered on campus?</span>
        <Link className="button secondary sm" href="/login">
          <span>Sign In</span>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
