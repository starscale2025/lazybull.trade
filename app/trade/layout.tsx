import type { Metadata } from "next";

// `page.tsx` here is a client component, and "use client" makes a `metadata`
// export illegal — so every one of these routes silently inherited the root
// layout's generic title and description. A route layout is the supported way
// to attach per-page metadata to a client page.
export const metadata: Metadata = {
  title: "Strategy Builder — lazybull",
  description:
    "Draw your thesis on the chart and see the strategies that fit it: max profit, max loss, breakevens and the odds, in plain English. Paper-only.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
