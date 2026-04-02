"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getApiFieldErrors, getApiFormErrors, setAuthToken } from "../../lib/api";

type LoginFieldName = "email" | "password";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginFieldName, string[]>>>({});
  const [loading, setLoading] = useState(false);

  function clearFieldError(fieldName: LoginFieldName) {
    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  }

  function getFieldErrorMessages(fieldName: LoginFieldName) {
    return fieldErrors[fieldName] ?? [];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormErrors([]);
    setFieldErrors({});

    try {
      const response = await api.login({ email, password });
      setAuthToken(response.token);

      if (response.user.role === "admin") {
        router.push("/admin/verifications");
        return;
      }

      if (response.user.walletAddress && response.user.verificationStatus === "verified") {
        router.push("/elections");
        return;
      }

      router.push("/wallet");
    } catch (submissionError) {
      setFormErrors(getApiFormErrors(submissionError, "Unable to sign in"));
      setFieldErrors(getApiFieldErrors(submissionError) as Partial<Record<LoginFieldName, string[]>>);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <p className="eyebrow">Access Portal</p>
      <h1>Sign in to the campus voting network</h1>
      <p className="muted">
        Students and teachers authenticate with their account first, then connect a wallet for blockchain voting.
      </p>

      <form className="stack-lg" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="name@college.edu"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
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
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            aria-invalid={getFieldErrorMessages("password").length > 0}
            required
          />
          {getFieldErrorMessages("password").map((errorMessage) => (
            <small className="field-error" key={`password-${errorMessage}`}>
              {errorMessage}
            </small>
          ))}
        </label>

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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="muted">
        Need a new account? <Link href="/signup">Create one here</Link>.
      </p>
    </div>
  );
}
