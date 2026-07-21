import type { Metadata } from "next";

// The page is a client component, so its metadata lives here — same pattern
// as /pro (a "use client" file cannot export `metadata`).
export const metadata: Metadata = {
  title: "Portfolio — lazybull",
  description:
    "Your paper-trading account in one place: equity, open positions, working orders, wagered totals, trade history and the cash ledger. Paper only — never advice.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
