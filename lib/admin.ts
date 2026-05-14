// Admin gate — single source of truth for "is this person allowed to see
// the cockpit?" Server-only. Reads ADMIN_EMAILS env (comma-separated) and
// falls back to a hardcoded founder list for first-boot convenience.
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
  return Array.from(new Set([...env, ...FOUNDERS]));
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
