import type { Metadata } from "next";

// `page.tsx` here is a client component, and "use client" makes a `metadata`
// export illegal — so every one of these routes silently inherited the root
// layout's generic title and description. A route layout is the supported way
// to attach per-page metadata to a client page.
export const metadata: Metadata = {
  title: "The Greek Surface · Lab — lazybull",
  description:
    "A live Black-Scholes surface over strike and days to expiry. Drag the handle and watch all five Greeks recompute in real time. Educational — not advice.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
