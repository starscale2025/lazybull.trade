import type { Metadata } from "next";

// The sign-in page is a "use client" component, so its title lives here.
export const metadata: Metadata = {
  title: "Sign in — lazybull",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
