import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid">
      <section className="panel hero-panel">
        <p className="eyebrow">Production Blueprint</p>
        <h1>Role-aware voting for students, teachers, and admins</h1>
        <p className="muted">
          This refactor splits authentication, admin verification, and blockchain voting into a clean production flow.
        </p>
      </section>

      <section className="panel">
        <p className="eyebrow">1. Accounts</p>
        <h2>Create a campus identity</h2>
        <p className="muted">Students and teachers sign up with role-specific profile fields before linking a wallet.</p>
        <Link className="button" href="/signup">
          Open sign-up
        </Link>
      </section>

      <section className="panel">
        <p className="eyebrow">2. Verification</p>
        <h2>Whitelist approved wallets</h2>
        <p className="muted">Admins review pending users and whitelist their addresses on-chain in safe-sized batches.</p>
        <Link className="button" href="/admin/verifications">
          Review queue
        </Link>
      </section>

      <section className="panel">
        <p className="eyebrow">3. Voting</p>
        <h2>Role-filtered election feed</h2>
        <p className="muted">Users only see elections their role can enter, and the contract repeats that rule on-chain.</p>
        <Link className="button" href="/elections">
          View elections
        </Link>
      </section>
    </div>
  );
}
