import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AppProviders } from "../providers/app-providers";
import { NetworkToggle } from "../components/navigation/NetworkToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "DVA Campus Voting",
  description: "Role-based Web3 voting for a college campus",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <main>
            <header className="shell-header">
              <div className="brand">
                <small>Decentralized Voting</small>
                <h2>Campus Governance Network</h2>
              </div>

              <div className="header-actions">
                <nav className="nav-row">
                  <Link className="nav-link" href="/login">
                    Login
                  </Link>
                  <Link className="nav-link" href="/signup">
                    Sign Up
                  </Link>
                  <Link className="nav-link" href="/wallet">
                    Wallet
                  </Link>
                  <Link className="nav-link" href="/elections">
                    Elections
                  </Link>
                  <Link className="nav-link" href="/admin/verifications">
                    Admin
                  </Link>
                </nav>

                <NetworkToggle />
              </div>
            </header>

            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
