// Admin cockpit layout — full-bleed, no marketing chrome (no Nav, no
// Footer). This layout is the gate that RENDERS the decision: React runs it
// before it descends into `children`, so on every full request it, not the
// page, is what a visitor actually sees. Hence the 403 screen lives here —
// it names the address you're signed in as and the env var that would admit
// it, which is the diagnostic that matters now that ADMIN_EMAILS replaces the
// allow-list instead of extending it (R-07); a bare redirect home would leave
// an operator who mis-set that var with nothing to go on.
//
// `app/admin/page.tsx` keeps a silent second check so a future refactor here
// can't drop protection; note layouts don't re-run on soft navigation between
// sibling admin pages, which is why that second layer is worth its lines.
//
// This layout is also the ONE place admin access is audited (R-07) — the call
// site below says why it's here and not in the page.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { auditAdminAccess } from "@/lib/db/audit";

// Never prerender — this gate must read the live session on every request. The
// page pins the same for its own layer.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/auth/signin?callbackUrl=/admin");
  const email = session.user?.email ?? null;
  const granted = isAdmin(email);
  // The single audit point for admin access, deliberately in the layout: this
  // gate decides before the page renders, so the page never observes a denial
  // and a writer there would only ever log grants. One writer also means the
  // two gate layers cannot double-count or drift apart. /admin is currently
  // the only route under this layout, so the layouts-don't-re-run caveat above
  // costs no records — add a second admin page and soft navigations between
  // the two will go unlogged.
  // Fire-and-forget by contract: this call cannot throw or block (lib/db/audit.ts).
  auditAdminAccess(granted ? "granted" : "denied-not-admin", email, session.user?.id);
  if (!granted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8 text-fg">
        <div className="max-w-md surface-instrument border border-border bg-surface p-8 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-bear">⊘ unauthorized</div>
          <h1 className="mt-3 font-display text-3xl tracking-tightest">Cockpit is admin-only.</h1>
          <p className="mt-3 text-sm text-fg-dim">
            You're signed in as <span className="text-fg">{email ?? "an account with no email"}</span>, but this email
            isn't on the admin allow-list. Ask the founder to add it to{" "}
            <code className="bg-bg px-1 py-0.5 text-bull">ADMIN_EMAILS</code>.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <a href="/" className="border border-border bg-bg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg">← home</a>
            <a href="/api/auth/signout" className="border border-border bg-bg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bear hover:text-bear">sign out</a>
          </div>
        </div>
      </main>
    );
  }
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-bg text-fg">
      {children}
    </div>
  );
}
