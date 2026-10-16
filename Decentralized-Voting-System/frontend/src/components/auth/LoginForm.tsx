"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getApiFieldErrors, getApiFormErrors, setAuthToken } from "../../lib/api";
import { useAppNetwork } from "../../providers/network-provider";

type LoginFieldName = "email" | "password";
type RoleTab = "student" | "faculty" | "admin";

export function LoginForm() {
  const router = useRouter();
  const { selectedNetwork } = useAppNetwork();
  const [selectedRole, setSelectedRole] = useState<RoleTab>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginFieldName, string[]>>>({});
  const [loading, setLoading] = useState(false);

  function handleRoleSelect(role: RoleTab) {
    setSelectedRole(role);
    // Helpful preset placeholders or values for testing
    if (role === "admin" && !email) {
      setEmail("admin@gmail.com");
    }
  }

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
      setFormErrors(getApiFormErrors(submissionError, "Unable to sign in. Please verify your credentials."));
      setFieldErrors(getApiFieldErrors(submissionError) as Partial<Record<LoginFieldName, string[]>>);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: "680px", margin: "0 auto" }}>
      {/* Top Eyebrow & Status Header */}
      <div className="row-between">
        <div className="eyebrow">
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>lock_open</span>
          <span>Access Portal &amp; Identity Verification</span>
        </div>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", color: "var(--ink-muted)" }}>
          E-ID: ACAD-2026
        </span>
      </div>

      <div className="panel-header">
        <h1 className="panel-title">Sign in to the campus voting network</h1>
        <p className="panel-subtitle">
          Students and faculty authenticate with verified institutional credentials first, then bind an encrypted cryptographic keypair for trustless campus governance.
        </p>
      </div>

      {/* Role Selector Tabs (Stitch) */}
      <div className="role-switcher-card">
        <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, color: "var(--ink-muted)" }}>
          Select Institutional Role
        </span>
        <div className="role-switcher-grid">
          <button
            type="button"
            className={`role-tab-btn ${selectedRole === "student" ? "active" : ""}`}
            onClick={() => handleRoleSelect("student")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>school</span>
            <span>Student</span>
          </button>

          <button
            type="button"
            className={`role-tab-btn ${selectedRole === "faculty" ? "active" : ""}`}
            onClick={() => handleRoleSelect("faculty")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>history_edu</span>
            <span>Faculty</span>
          </button>

          <button
            type="button"
            className={`role-tab-btn ${selectedRole === "admin" ? "active" : ""}`}
            onClick={() => handleRoleSelect("admin")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>admin_panel_settings</span>
            <span>Delegate</span>
          </button>
        </div>
      </div>

      <form className="stack-lg" onSubmit={handleSubmit}>
        {/* Campus Email Field */}
        <div className="field">
          <div className="field-label">
            <span>Campus Domain Email</span>
            <span className="field-hint">Registrar Lookup Active</span>
          </div>
          <div className="input-container">
            <span className="material-symbols-outlined input-icon">alternate_email</span>
            <input
              type="email"
              placeholder={
                selectedRole === "student"
                  ? "student@college.edu"
                  : selectedRole === "faculty"
                  ? "professor@college.edu"
                  : "admin@gmail.com"
              }
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

        {/* Password Field */}
        <div className="field">
          <div className="field-label">
            <span>Institutional Password / Token</span>
            <span className="field-hint">Encrypted Secret</span>
          </div>
          <div className="input-container">
            <span className="material-symbols-outlined input-icon">key</span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••••••"
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
              aria-label={showPassword ? "Hide password" : "Show password"}
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

          {/* Entropy Strength Indicator */}
          {password.length > 0 && (
            <div className="entropy-meter">
              <div className="entropy-track">
                <div className="entropy-segment" style={{ opacity: password.length > 3 ? 1 : 0.3 }}></div>
                <div className="entropy-segment" style={{ opacity: password.length >= 8 ? 1 : 0.3 }}></div>
                <div
                  className="entropy-segment"
                  style={{ opacity: password.length >= 10 && /[0-9!@#$%^&*]/.test(password) ? 1 : 0.3 }}
                ></div>
              </div>
              <span className="entropy-label">
                {password.length < 8 ? "Weak" : password.length < 10 ? "Standard" : "Entropy: High (SHA-256)"}
              </span>
            </div>
          )}
        </div>

        {/* Network Synchronized Telemetry Box */}
        <div className="telemetry-box">
          <div className="telemetry-icon-wrap">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>cloud_done</span>
          </div>
          <div className="telemetry-content">
            <span className="telemetry-title">
              {selectedNetwork === "local" ? "Demo Hardhat RPC Ready" : "Polygon Amoy Synchronized"}
            </span>
            <span className="telemetry-desc">
              {selectedNetwork === "local"
                ? "Chain ID: 31337 · Instant local gasless confirmation"
                : "Chain ID: 80002 · Live Ethereum Layer-2 consensus"}
            </span>
          </div>
        </div>

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
            {loading ? "sync" : "login"}
          </span>
          <span>{loading ? "Authenticating Identity..." : "Sign In with Credentials"}</span>
        </button>
      </form>

      <div className="row-between" style={{ paddingTop: "12px", borderTop: "1px solid var(--border-hairline)" }}>
        <span style={{ color: "var(--ink-secondary)", fontSize: "13px" }}>Need a campus voting identity?</span>
        <Link className="button secondary sm" href="/signup">
          <span>Create an account</span>
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
