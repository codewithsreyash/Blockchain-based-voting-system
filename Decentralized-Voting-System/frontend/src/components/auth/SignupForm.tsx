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
      setFormErrors(getApiFormErrors(submissionError, "Unable to create account"));
      setFieldErrors(getApiFieldErrors(submissionError) as Partial<Record<SignupFieldName, string[]>>);
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
            onClick={() => {
              setRole("student");
              setFormErrors([]);
              setFieldErrors({});
            }}
          >
            Student
          </button>
          <button
            type="button"
            className={`pill ${role === "teacher" ? "active" : ""}`}
            onClick={() => {
              setRole("teacher");
              setFormErrors([]);
              setFieldErrors({});
            }}
          >
            Teacher
          </button>
        </div>

        <label className="field">
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              clearFieldError("fullName");
            }}
            aria-invalid={getFieldErrorMessages("fullName").length > 0}
            required
          />
          {getFieldErrorMessages("fullName").map((errorMessage) => (
            <small className="field-error" key={`fullName-${errorMessage}`}>
              {errorMessage}
            </small>
          ))}
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
            placeholder="name@college.edu"
            aria-invalid={getFieldErrorMessages("email").length > 0}
            required
          />
          {getFieldErrorMessages("email").map((errorMessage) => (
            <small className="field-error" key={`email-${errorMessage}`}>
              {errorMessage}
            </small>
          ))}
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            placeholder="Minimum 8 characters"
            aria-invalid={getFieldErrorMessages("password").length > 0}
            required
          />
          {getFieldErrorMessages("password").map((errorMessage) => (
            <small className="field-error" key={`password-${errorMessage}`}>
              {errorMessage}
            </small>
          ))}
        </label>

        {role === "student" ? (
          <>
            <label className="field">
              <span>Student ID</span>
              <input
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  clearFieldError("studentId");
                }}
                aria-invalid={getFieldErrorMessages("studentId").length > 0}
                required
              />
              {getFieldErrorMessages("studentId").map((errorMessage) => (
                <small className="field-error" key={`studentId-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </label>
            <label className="field">
              <span>Major</span>
              <input
                value={major}
                onChange={(event) => {
                  setMajor(event.target.value);
                  clearFieldError("major");
                }}
                aria-invalid={getFieldErrorMessages("major").length > 0}
                required
              />
              {getFieldErrorMessages("major").map((errorMessage) => (
                <small className="field-error" key={`major-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Department</span>
              <input
                value={department}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  clearFieldError("department");
                }}
                aria-invalid={getFieldErrorMessages("department").length > 0}
                required
              />
              {getFieldErrorMessages("department").map((errorMessage) => (
                <small className="field-error" key={`department-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </label>
            <label className="field">
              <span>Employee ID</span>
              <input
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  clearFieldError("employeeId");
                }}
                aria-invalid={getFieldErrorMessages("employeeId").length > 0}
                required
              />
              {getFieldErrorMessages("employeeId").map((errorMessage) => (
                <small className="field-error" key={`employeeId-${errorMessage}`}>
                  {errorMessage}
                </small>
              ))}
            </label>
          </>
        )}

        {formErrors.length > 0 ? (
          <div className="stack-sm">
            {formErrors.map((errorMessage) => (
              <p className="message error" key={errorMessage}>
                {errorMessage}
              </p>
            ))}
          </div>
        ) : null}

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
