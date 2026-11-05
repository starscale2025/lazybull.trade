// Admin cockpit.
//
// The gate a visitor actually meets is `app/admin/layout.tsx`: it runs before
// React descends into this page, and it owns the 403 screen that explains a
// denial. The check below is the second layer — deliberately silent, because
// it is unreachable while the layout gate exists and a duplicate 403 screen
// here would only be markup that drifts. It earns its place by making a
// refactor that deletes the layout gate fail closed rather than open.
//
// Access auditing (R-07) belongs to the layout and ONLY the layout: it is the
// gate that sees denials, and a second writer here would double-count grants.
//
// DATA (2026-09 diligence memo): "The admin dashboard's KPIs (active sessions,
// paper trades, AI tokens) are seeded pseudo-random mocks." They were. Every
// number on this page now comes from getAdminMetrics(), which reads MongoDB on
// each request; where a source does not exist the tile says so in words. The
// first three KPI cells are the three numbers the memo asked to see on one
// page: signups in 7 days, the share of signups that placed a paper trade
// within 24 hours, and the share active in three separate weeks.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { HEALTH_SUBTITLE, OFFLINE_NOTE } from "@/lib/admin-data";
import { getAdminMetrics } from "@/lib/admin-metrics";
import { CockpitTopBar } from "@/components/admin/CockpitTopBar";
import { KpiStrip } from "@/components/admin/KpiStrip";
import { SystemHealthChart } from "@/components/admin/SystemHealthChart";
import { LiveEventStream } from "@/components/admin/LiveEventStream";
import { SymbolHeatmap } from "@/components/admin/SymbolHeatmap";
import { BotRunDistribution } from "@/components/admin/BotRunDistribution";
import { UserGeoMap } from "@/components/admin/UserGeoMap";
import { RecentTrades } from "@/components/admin/RecentTrades";
import { ErrorTopList } from "@/components/admin/ErrorTopList";
import { SignupTimeline } from "@/components/admin/SignupTimeline";
import { ProFunnel } from "@/components/admin/ProFunnel";
import { CohortTable } from "@/components/admin/CohortTable";
import { TeacherPanel } from "@/components/admin/TeacherPanel";
import { PracticePanel } from "@/components/admin/PracticePanel";
import { RevenuePanel } from "@/components/admin/RevenuePanel";
import { KillSwitchPanel } from "@/components/admin/KillSwitchPanel";
import { CommandPalette } from "@/components/admin/CommandPalette";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/admin" },
  title: "ADMIN COCKPIT — lazybull",
  robots: { index: false, follow: false },
};

// Explicit guard: never prerender or cache this route — the gate must read the
// live session on every request, and the aggregates must be as fresh as the
// footer claims. auth()'s cookie access already forces dynamic rendering; this
// pins that behavior against future refactors.
export const dynamic = "force-dynamic";

/** Deploy facts, from the platform's own env. Each falls back to "unknown"
    rather than to a plausible-looking constant — the top bar used to print a
    hardcoded build sha and region on every machine it ran on. */
function deployInfo() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "";
  return {
    build: sha ? sha.slice(0, 7) : "unknown",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    region: process.env.VERCEL_REGION ?? process.env.FLY_REGION ?? "unknown",
  };
}

// Server component — auth is re-checked here, before any admin module renders.
export default async function AdminPage() {
  // ── AUTH GATE (second layer) ──────────────────────────────────────────
  // Anonymous → sign-in. Signed-in but not on the allow-list (including a
  // session with no email at all) → home. The `!email` arm is not redundant
  // with `isAdmin`, which already rejects null: it is what narrows `email` to
  // a string for the render below. Runs before any admin data is pulled.
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!session) redirect("/auth/signin?callbackUrl=/admin");
  if (!email || !isAdmin(email)) redirect("/");
  // ──────────────────────────────────────────────────────────────────────

  // One clock for the whole page: every window below is measured from the same
  // instant, so two tiles can never disagree about where "7 days ago" is.
  const data = await getAdminMetrics(new Date());
  const deploy = deployInfo();
  const stamp = new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 19);

  return (
    <main className="relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Background atmosphere — matches the marketing site so context feels continuous */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-32 top-20 h-[30rem] w-[30rem] rounded-full"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--bull) 10%, transparent) 0%, transparent 70%)", filter: "blur(120px)" }}
        />
        <div
          className="absolute right-0 top-1/2 h-[26.25rem] w-[26.25rem] -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--cyan) 6%, transparent) 0%, transparent 70%)", filter: "blur(140px)" }}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid opacity-30" />

      <div className="relative z-10 flex flex-col">
        <CockpitTopBar admin={email} build={deploy.build} env={deploy.env} region={deploy.region} />

        {/* Page hero — mission-control headline */}
        <header className="shell shell-wide pt-8 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="t-eyebrow text-fg-faint">lazybull · platform · {deploy.env}</div>
              <h1 className="mt-2 t-title text-fg">
                Cockpit<span className="text-bull">.</span>
              </h1>
              <p className="mt-2 max-w-[60ch] t-body-sm text-fg-dim">
                Every number here is an aggregate of the events, subscriptions and submissions
                collections, computed when you loaded the page. Where a source does not exist,
                the tile says so instead of showing a number.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 t-chrome text-fg-faint">
              <span className="surface-instrument border border-border bg-surface px-2 py-1">role <span className="text-bull">admin</span></span>
              <span className="surface-instrument border border-border bg-surface px-2 py-1">scope <span className="text-fg">global</span></span>
              {/* The chip that has to be true. It said "data · live" over
                  seeded PRNG output; now it reports what the query actually
                  did. */}
              {data.ok ? (
                data.degraded.length ? (
                  <span className="border border-amber/50 bg-amber/5 px-2 py-1 text-amber">data · partial</span>
                ) : (
                  <span className="border border-bull/40 bg-bull/5 px-2 py-1 text-bull">data · mongo</span>
                )
              ) : (
                <span className="border border-bear bg-bear/10 px-2 py-1 text-bear">offline · no data</span>
              )}
            </div>
          </div>
        </header>

        {!data.ok && (
          <section className="shell shell-wide pb-4">
            <div className="border border-bear bg-bear/5 px-4 py-3 font-mono text-[0.6875rem] leading-relaxed text-bear">
              <span className="uppercase tracking-[0.2em]">mongo unreachable</span>
              <span className="mx-2 text-fg-faint">·</span>
              <span className="text-fg-dim">{OFFLINE_NOTE}</span>
              {data.error && <div className="mt-1 text-fg-faint">{data.error}</div>}
            </div>
          </section>
        )}

        {data.ok && data.degraded.length > 0 && (
          <section className="shell shell-wide pb-4">
            <div className="border border-amber/50 bg-amber/5 px-4 py-3 font-mono text-[0.6875rem] leading-relaxed text-amber">
              <span className="uppercase tracking-[0.2em]">partial</span>
              <span className="mx-2 text-fg-faint">·</span>
              <span className="text-fg-dim">
                these groups failed their own query and are showing zeros, not estimates: {data.degraded.join(", ")}
              </span>
            </div>
          </section>
        )}

        {/* KPI strip — the memo's three numbers first, in its order */}
        <section className="shell shell-wide">
          <KpiStrip cells={data.kpis} />
        </section>

        {/* Row: ingest rate (8/12) + kill switch (4/12) */}
        <section className="mt-5 grid shell shell-wide grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8" style={{ minHeight: 320 }}>
            <SystemHealthChart data={data.health} note={HEALTH_SUBTITLE} />
          </div>
          <div className="col-span-12 lg:col-span-4" style={{ minHeight: 320 }}>
            <KillSwitchPanel history={data.kill} />
          </div>
        </section>

        {/* Row: signups (8/12) + funnel (4/12) */}
        <section className="mt-5 grid shell shell-wide grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8" style={{ minHeight: 300 }}>
            <SignupTimeline data={data.signups} activation={data.activation} />
          </div>
          <div className="col-span-12 lg:col-span-4" style={{ minHeight: 300 }}>
            <ProFunnel steps={data.funnel} />
          </div>
        </section>

        {/* Row: weekly cohorts full width — the memo's third number */}
        <section className="mt-5 shell shell-wide">
          <CohortTable data={data.cohorts} />
        </section>

        {/* Row: live event stream (7/12) + errors (5/12) */}
        <section className="mt-5 grid shell shell-wide grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7" style={{ height: 460 }}>
            <LiveEventStream rows={data.stream} />
          </div>
          <div className="col-span-12 lg:col-span-5" style={{ height: 460 }}>
            <ErrorTopList data={data.errors} />
          </div>
        </section>

        {/* Row: revenue full width */}
        <section className="mt-5 shell shell-wide">
          <RevenuePanel data={data.revenue} />
        </section>

        {/* Row: ai teacher (7/12) + practice (5/12) */}
        <section className="mt-5 grid shell shell-wide grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-7">
            <TeacherPanel data={data.teacher} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <PracticePanel data={data.practice} />
          </div>
        </section>

        {/* Row: symbols (8/12) + quant bots (4/12) */}
        <section className="mt-5 grid shell shell-wide grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <SymbolHeatmap data={data.symbols} />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <BotRunDistribution data={data.bots} />
          </div>
        </section>

        {/* Row: order flow (7/12) + geo (5/12) */}
        <section className="mt-5 grid shell shell-wide grid-cols-12 gap-4 pb-16">
          <div className="col-span-12 lg:col-span-7" style={{ minHeight: 300 }}>
            <RecentTrades data={data.trades} />
          </div>
          <div className="col-span-12 lg:col-span-5" style={{ minHeight: 300 }}>
            <UserGeoMap data={data.geo} />
          </div>
        </section>

        {/* Footer rail */}
        <footer className="shell shell-wide border-t border-border py-4 t-chrome text-fg-faint">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`size-1.5 rounded-full ${data.ok ? "bg-bull pulse-dot" : "bg-bear"}`} />
              <span className={data.ok ? "text-bull" : "text-bear"}>cockpit · {data.ok ? "ok" : "offline"}</span>
              <span className="text-fg-faint">·</span>
              {/* Was "data refreshes once per minute · seeded". It did neither. */}
              <span>computed from Mongo on every load · {stamp}Z</span>
            </div>
            <div className="flex items-center gap-3">
              <span>signed in as <span className="text-fg">{email}</span> <span className="ml-2 border border-bull/40 bg-bull/5 px-1.5 py-0.5 text-bull">auth · on</span></span>
              <span className="text-fg-faint">·</span>
              <span>press <span className="text-bull">⌘K</span> for actions</span>
            </div>
          </div>
        </footer>
      </div>

      <CommandPalette />
    </main>
  );
}
