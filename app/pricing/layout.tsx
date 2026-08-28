import type { Metadata } from "next";

// `page.tsx` here is a client component, and "use client" makes a `metadata`
// export illegal — so every one of these routes silently inherited the root
// layout's generic title and description. A route layout is the supported way
// to attach per-page metadata to a client page.
export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/pricing" },
  title: "Pricing — lazybull",
  description:
    "Paper-only options education. Free to learn, priced for the people who want the whole workbench. Monthly or annual, no contracts.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
