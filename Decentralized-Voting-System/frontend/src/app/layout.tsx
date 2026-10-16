import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "../providers/app-providers";
import { Header } from "../components/navigation/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Governance Network | Decentralized Voting System",
  description: "Role-aware Web3 cryptographic voting platform for university students, faculty, and administrators",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>
          <main>
            <Header />
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
