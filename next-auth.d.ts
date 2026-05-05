// Augment NextAuth Session/User types so TS knows about the Mongo `id` field.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
