// NextAuth v5 (Auth.js) configuration.
//
// Sessions are persisted in Mongo via the official adapter. Google is the
// only provider for now — add more later (GitHub, email magic link, etc.).
// `auth()` is the universal session reader for server components and routes;
// `signIn` / `signOut` are the actions used by client components.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { mongo } from "./mongo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(mongo(), {
    databaseName: process.env.MONGODB_DB || "lazybull",
  }),
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
  trustHost: true,
});
