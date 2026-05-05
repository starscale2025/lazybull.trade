"use client";

// Pass-through wrapper around next-auth's SessionProvider so it can be
// dropped into the (server) RootLayout without "use client" leakage.

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
