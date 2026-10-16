import Link from "next/link";

export default function HomePage() {
  return (
    <div className="stack-xl">
      {/* Hero Broadsheet Section */}
      <section className="panel hero-panel">
        <div className="panel-header">
          <div className="eyebrow">
            <span className="pulse-dot"></span>
            <span>Decentralized Campus Governance · Mainnet Protocol</span>
          </div>
          <h1 className="panel-title" style={{ fontSize: "2.75rem", maxWidth: "800px" }}>
            Institutional trust meets cryptographic consensus.
          </h1>
          <p className="panel-subtitle" style={{ maxWidth: "720px", fontSize: "16px" }}>
            Students and faculty authenticate with verified academic credentials, link an encrypted Web3 wallet,
            and participate in trustless, role-partitioned collegiate elections enforced on-chain.
          </p>
        </div>

        {/* Action Callouts */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <Link className="button" href="/login">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>lock_open</span>
            <span>Access Portal</span>
          </Link>
          <Link className="button secondary" href="/elections">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>how_to_vote</span>
            <span>View Active Ballots</span>
          </Link>
          <Link className="button secondary" href="/signup">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>person_add</span>
            <span>Register Credentials</span>
          </Link>
        </div>

        {/* Live Network & Security Telemetry Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginTop: "16px",
            paddingTop: "24px",
            borderTop: "1px solid var(--border-hairline)",
          }}
        >
          <div className="telemetry-box">
            <div className="telemetry-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>verified_user</span>
            </div>
            <div className="telemetry-content">
              <span className="telemetry-title">Contract Verified</span>
              <span className="telemetry-desc" style={{ fontFamily: "var(--font-code)" }}>Polygon Amoy 80002</span>
            </div>
          </div>

          <div className="telemetry-box">
            <div className="telemetry-icon-wrap" style={{ background: "var(--primary-fixed)", color: "var(--on-primary-fixed)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>security</span>
            </div>
            <div className="telemetry-content">
              <span className="telemetry-title">Role Partitions</span>
              <span className="telemetry-desc">Student & Faculty Rings</span>
            </div>
          </div>

          <div className="telemetry-box">
            <div className="telemetry-icon-wrap" style={{ background: "var(--surface-container)", color: "#1e3a8a" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>dynamic_form</span>
            </div>
            <div className="telemetry-content">
              <span className="telemetry-title">Batched Whitelist</span>
              <span className="telemetry-desc">Max 100 per On-Chain Write</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Architecture Pillars */}
      <div className="grid-3">
        <section className="panel">
          <div className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>school</span>
            <span>1. Identity Verification</span>
          </div>
          <h2>Academic Credentials</h2>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
            Students, faculty, and delegates sign up using role-specific parameters (Roll Number, Department, Faculty ID) before binding an EVM wallet keypair.
          </p>
          <div style={{ marginTop: "auto", paddingTop: "12px" }}>
            <Link className="button secondary sm" href="/signup" style={{ width: "100%" }}>
              <span>Open Registration</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>admin_panel_settings</span>
            <span>2. On-Chain Registry</span>
          </div>
          <h2>Admin Whitelist</h2>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
            University election delegates review pending credentials and whitelist voter wallet addresses directly in the Solidity smart contract via gas-safe batching.
          </p>
          <div style={{ marginTop: "auto", paddingTop: "12px" }}>
            <Link className="button secondary sm" href="/admin/verifications" style={{ width: "100%" }}>
              <span>Review Admin Queue</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>ballot</span>
            <span>3. Trustless Balloting</span>
          </div>
          <h2>Role-Filtered Feeds</h2>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", lineHeight: "1.6" }}>
            Voters only unlock elections matching their verified role. Smart contract assertions reject any duplicate votes or unauthorized ballots on-chain.
          </p>
          <div style={{ marginTop: "auto", paddingTop: "12px" }}>
            <Link className="button secondary sm" href="/elections" style={{ width: "100%" }}>
              <span>Cast Live Ballot</span>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
