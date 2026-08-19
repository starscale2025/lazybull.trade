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

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  kpis,
  healthSeries,
  recentEvents,
  topSymbols,
  topBots,
  recentTrades,
  signupTimeline,
  geoDots,
  topErrors,
  proFunnel,
} from "@/lib/admin-data";
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
import { KillSwitchPanel } from "@/components/admin/KillSwitchPanel";
import { CommandPalette } from "@/components/admin/CommandPalette";

export const metadata = {
  title: "ADMIN COCKPIT — lazybull.trade",
  robots: { index: false, follow: false },
};

// Explicit guard: never prerender or cache this route — the gate must read the
// live session on every request. auth()'s cookie access already forces dynamic
// rendering; this pins that behavior against future refactors.
export const dynamic = "force-dynamic";

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

  // Pull all data on the server. Mock today; swap to real Mongo aggregates
  // later — the component contract stays the same.
  const data = {
    kpis: kpis(),
    health: healthSeries(),
    events: recentEvents(),
    symbols: topSymbols(),
    bots: topBots(),
    trades: recentTrades(),
    signups: signupTimeline(),
    geo: geoDots(),
    errors: topErrors(),
    funnel: proFunnel(),
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-bg text-fg">
      {/* Background atmosphere — matches the marketing site so context feels continuous */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-32 top-20 h-[480px] w-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--bull) 10%, transparent) 0%, transparent 70%)", filter: "blur(120px)" }}
        />
        <div
          className="absolute right-0 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--cyan) 6%, transparent) 0%, transparent 70%)", filter: "blur(140px)" }}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid opacity-30" />

      <div className="relative z-10 flex flex-col">
        <CockpitTopBar admin={email} />

        {/* Page hero — mission-control headline */}
        <header className="mx-auto w-full max-w-[1600px] px-5 pt-8 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="t-eyebrow text-fg-faint">
                lazybull · platform · prod
              </div>
              <h1 className="mt-2 t-title text-fg">
                Cockpit<span className="text-bull">.</span>
              </h1>
              <p className="mt-2 max-w-[60ch] t-body-sm text-fg-dim">
                Every paper trade, every teacher token, every kill switch — in one window.
                You're the only person who sees this.
              </p>
            </div>
            <div className="flex items-center gap-2 t-chrome text-fg-faint">
              <span className="border border-border bg-surface px-2 py-1">role <span className="text-bull">admin</span></span>
              <span className="border border-border bg-surface px-2 py-1">scope <span className="text-fg">global</span></span>
              <span className="border border-bull/40 bg-bull/5 px-2 py-1 text-bull">data · live</span>
            </div>
          </div>
        </header>

        {/* KPI strip */}
        <section className="mx-auto w-full max-w-[1600px] px-5">
          <KpiStrip cells={data.kpis} />
        </section>

        {/* Row: system health (8/12) + kill switch (4/12) */}
        <section className="mx-auto mt-5 grid w-full max-w-[1600px] grid-cols-12 gap-4 px-5">
          <div className="col-span-12 lg:col-span-8" style={{ minHeight: 320 }}>
            <SystemHealthChart data={data.health} />
          </div>
          <div className="col-span-12 lg:col-span-4" style={{ minHeight: 320 }}>
            <KillSwitchPanel />
          </div>
        </section>

        {/* Row: live event stream (7/12) + top errors (5/12) */}
        <section className="mx-auto mt-5 grid w-full max-w-[1600px] grid-cols-12 gap-4 px-5">
          <div className="col-span-12 lg:col-span-7" style={{ height: 460 }}>
            <LiveEventStream initial={data.events} />
          </div>
          <div className="col-span-12 lg:col-span-5" style={{ height: 460 }}>
            <ErrorTopList rows={data.errors} />
          </div>
        </section>

        {/* Row: geo map (8/12) + bot distribution (4/12) */}
        <section className="mx-auto mt-5 grid w-full max-w-[1600px] grid-cols-12 gap-4 px-5">
          <div className="col-span-12 lg:col-span-8" style={{ minHeight: 380 }}>
            <UserGeoMap dots={data.geo} />
          </div>
          <div className="col-span-12 lg:col-span-4" style={{ minHeight: 380 }}>
            <BotRunDistribution rows={data.bots} />
          </div>
        </section>

        {/* Row: symbol heatmap full width */}
        <section className="mx-auto mt-5 w-full max-w-[1600px] px-5">
          <SymbolHeatmap rows={data.symbols} />
        </section>

        {/* Row: recent trades full width */}
        <section className="mx-auto mt-5 w-full max-w-[1600px] px-5" style={{ height: 380 }}>
          <RecentTrades rows={data.trades} />
        </section>

        {/* Row: signup timeline (8/12) + pro funnel (4/12) */}
        <section className="mx-auto mt-5 grid w-full max-w-[1600px] grid-cols-12 gap-4 px-5 pb-16">
          <div className="col-span-12 lg:col-span-8" style={{ minHeight: 280 }}>
            <SignupTimeline rows={data.signups} />
          </div>
          <div className="col-span-12 lg:col-span-4" style={{ minHeight: 280 }}>
            <ProFunnel steps={data.funnel} />
          </div>
        </section>

        {/* Footer rail */}
        <footer className="mx-auto w-full max-w-[1600px] border-t border-border px-5 py-4 t-chrome text-fg-faint">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              <span className="text-bull">cockpit · ok</span>
              <span className="text-fg-faint">·</span>
              <span>data refreshes once per minute · seeded</span>
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
