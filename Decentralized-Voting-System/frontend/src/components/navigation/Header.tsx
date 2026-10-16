"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { NetworkToggle } from "./NetworkToggle";

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  const navLinks = [
    { href: "/elections", label: "Elections" },
    { href: "/wallet", label: "Wallet" },
    { href: "/signup", label: "Sign Up" },
    { href: "/login", label: "Sign In" },
    { href: "/admin/verifications", label: "Admin" },
  ];

  return (
    <header className="shell-header">
      <div className="brand">
        <div className="brand-telemetry">
          <span className="pulse-dot"></span>
          <small>Decentralized Voting</small>
          <span style={{ color: "var(--outline-variant)" }}>•</span>
          <span style={{ fontFamily: "var(--font-code)", fontSize: "11px", color: "var(--ink-muted)" }}>
            Consensus v2.4
          </span>
        </div>
        <Link href="/">
          <h2>Campus Governance Network</h2>
        </Link>
      </div>

      <div className="header-actions">
        <nav className="nav-row" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                className={`nav-link ${isActive ? "active" : ""}`}
                href={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <NetworkToggle />

        {isConnected && address ? (
          <Link
            href="/wallet"
            className="badge badge-verified"
            style={{ fontFamily: "var(--font-code)", padding: "8px 12px", textTransform: "none" }}
            title={`Connected wallet: ${address}`}
          >
            <span className="pulse-dot"></span>
            <span>{truncateAddress(address)}</span>
          </Link>
        ) : (
          <Link href="/wallet" className="button sm" style={{ padding: "8px 14px" }}>
            Connect
          </Link>
        )}
      </div>
    </header>
  );
}
