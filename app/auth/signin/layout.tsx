import type { Metadata } from "next";

// The sign-in page is a "use client" component, so its title lives here.
export const metadata: Metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/auth/signin" },
  title: "Sign in — lazybull",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
