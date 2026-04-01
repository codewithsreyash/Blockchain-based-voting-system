"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setAuthToken } from "../../lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

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
      setError(submissionError instanceof Error ? submissionError.message : "Unable to sign in");
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
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? <p className="message error">{error}</p> : null}

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
