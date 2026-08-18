// NextAuth v5 (Auth.js) configuration.
//
// Sessions are persisted in Mongo via the official adapter. Google is the
// only provider for now — add more later (GitHub, email magic link, etc.).
// `auth()` is the universal session reader for server components and routes;
// `signIn` / `signOut` are the actions used by client components.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { mongo } from "./mongo";
import { logServerEvent } from "./db/events";

// R-11 — where callback and redirect URLs get their origin.
//
// AUTH_URL, when set, IS the pin: next-auth rewrites every incoming request's
// origin to it before Auth.js sees the request, and builds every callback and
// redirect URL from that origin, so a forged Host header can no longer steer
// the OAuth callback. Set it in production to the canonical origin
// (AUTH_URL=https://lazybull.trade). It is mandatory before this ever
// self-hosts behind a proxy that doesn't normalize Host.
//
// `trustHost` below is NOT a host allow-list, which is the part worth stating
// plainly: in @auth/core it is one boolean deciding whether the handler runs
// at all, and false rejects every request with UntrustedHost. So it stays true
// even once AUTH_URL is set — turning it off buys no origin safety and would
// lock every account out of any deploy that forgot the env var. The honest
// residual: with no AUTH_URL the inbound Host is trusted, which is fine on
// Vercel (it normalizes Host) and in local dev, and is what this warns about.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.AUTH_URL &&
  !process.env.NEXTAUTH_URL &&
  !process.env.VERCEL
) {
  console.warn(
    "auth: AUTH_URL is not set — callback URLs are derived from the inbound Host header. Pin AUTH_URL before self-hosting.",
  );
}

// R-08 — don't keep what nothing reads.
//
// The adapter's `linkAccount` is the only writer of the accounts collection,
// and it inserts the provider's token set verbatim. Nothing in this app ever
// reads those tokens: there is no `jwt` callback, the database-session
// `session` callback below receives only `{ session, user }`, and a scoped
// grep across app/ lib/ components/ scripts/ for access_token / refresh_token
// / id_token / providerAccountId / getToken returns zero hits outside this
// file. Re-sign-in works off `getUserByAccount({ provider, providerAccountId })`
// — both fields survive the strip — and @auth/core only calls `linkAccount`
// when no row exists yet, so tokens were written once at first sign-in and
// never refreshed or consulted afterwards.
//
// So they are stored capability, never spent: pure blast radius on a leaked
// MONGODB_URI. Deleting the field beats encrypting it, and unlike encryption
// it cannot lock anyone out — the worst case of a wrong strip is that a future
// feature has to ask Google for a fresh token, which is what re-consent does
// anyway. Only the three credential fields go; the non-secret metadata
// (provider, type, userId, scope, token_type, expires_at) stays, so an account
// row is still readable when debugging a linking problem.
//
// This only affects NEW rows. Accounts linked before this shipped still hold
// their original tokens; clearing them is a one-time $unset (see the docs
// note), not something this code path can reach.
function withoutOAuthTokens(adapter: Adapter): Adapter {
  const linkAccount = adapter.linkAccount!.bind(adapter);
  return {
    ...adapter,
    linkAccount: (account: AdapterAccount) => {
      const stripped = { ...account };
      delete stripped.access_token;
      delete stripped.refresh_token;
      delete stripped.id_token;
      return linkAccount(stripped);
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: withoutOAuthTokens(
    MongoDBAdapter(mongo(), {
      databaseName: process.env.MONGODB_DB || "lazybull",
    }),
  ),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Always show the account-picker rather than auto-relogging the
      // most-recent account. Better UX for shared computers.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Surface the Mongo user id so client code can scope queries.
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  // Server-side facts go straight into the events stream — a client tracker
  // can be blocked or closed mid-flow; this can't.
  events: {
    async signIn({ user, isNewUser }) {
      await logServerEvent(isNewUser ? "signup" : "sign_in", user?.id, {
        email_domain: user?.email?.split("@")[1] ?? null,
      });
    },
    async signOut() {
      await logServerEvent("sign_out");
    },
  },
  // Stays true on purpose — see the AUTH_URL note at the top of this file.
  // The origin pin is AUTH_URL; this flag is only an on/off switch.
  trustHost: true,
});
