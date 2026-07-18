import type { Metadata } from "next";

// `page.tsx` here is a client component, and "use client" makes a `metadata`
// export illegal — so every one of these routes silently inherited the root
// layout's generic title and description. A route layout is the supported way
// to attach per-page metadata to a client page.
export const metadata: Metadata = {
  title: "Visual Options Chain — lazybull",
  description:
    "The full options chain as a heatmap. Drag across strikes to build spreads and read the payoff before you commit. Paper-only.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
