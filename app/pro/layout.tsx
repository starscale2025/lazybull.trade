import type { Metadata } from "next";

// `page.tsx` here is a client component, and "use client" makes a `metadata`
// export illegal — so every one of these routes silently inherited the root
// layout's generic title and description. A route layout is the supported way
// to attach per-page metadata to a client page.
export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/pro" },
  title: "Pro Charts — lazybull",
  description:
    "Multi-pane charting with drawing tools, indicators, alerts and bar replay. Built for reading the tape, not for taking positions.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
