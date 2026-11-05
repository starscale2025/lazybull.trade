// Augment NextAuth's Session so TS knows about the two fields the session
// callback in lib/auth.ts attaches: the Mongo `id`, and the billing `plan`
// that getPlan() (lib/billing/entitlements.ts) resolved for this request.
//
// `plan` is never optional. A session without a paid subscription is a FREE
// one, not an undefined one — the 2026-09 diligence memo's "no plan field on
// the user model" is closed by making the field impossible to forget, so a
// gated route reads `session.user.plan` without a fallback of its own.
import type { DefaultSession } from "next-auth";
import type { Plan } from "./lib/billing/types";

declare module "next-auth" {
  interface Session {
    user: { id: string; plan: Plan } & DefaultSession["user"];
  }
}
