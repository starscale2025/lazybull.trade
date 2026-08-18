// Admin gate — single source of truth for "is this person allowed to see
// the cockpit?" Server-only. ADMIN_EMAILS (comma-separated) is AUTHORITATIVE
// whenever it is non-empty: it replaces the list outright, so an address —
// the founder's included — can be revoked by editing env alone. FOUNDERS is
// the first-boot fallback and applies ONLY while ADMIN_EMAILS is empty, so an
// unconfigured deploy still lets its owner in instead of locking everyone out.
//
// Governance consequence of that ordering (R-07): setting ADMIN_EMAILS without
// the founder address in it revokes the founder. That is the point — a
// hardcoded, env-proof admin is not an allow-list, it is a backdoor.
//
// Usage:
//   const session = await auth();
//   if (!isAdmin(session?.user?.email)) redirect("/auth/signin");

const FOUNDERS = [
  "shauryanegi099@gmail.com",
];

export function adminEmails(): string[] {
  const env = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // No union: a union would make ADMIN_EMAILS additive-only and unable to
  // revoke. Unset, blank, or nothing but separators all count as empty and
  // fall back to FOUNDERS.
  return env.length ? Array.from(new Set(env)) : FOUNDERS.map((e) => e.toLowerCase());
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
