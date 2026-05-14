// Admin cockpit.
//
// ⚠️  AUTH IS DISABLED RIGHT NOW (dev convenience).
// Before pushing to prod, re-enable the gate by:
//   1. uncommenting the `auth()` import + `isAdmin` import below
//   2. uncommenting the auth-check block in AdminPage()
// The gate logic is preserved verbatim — you should not need to rewrite it.

// import { redirect } from "next/navigation";
// import { auth } from "@/lib/auth";
// import { isAdmin } from "@/lib/admin";
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

// Server component — auth happens here, before any admin module renders.
export default async function AdminPage() {
  // ── DEV GATE OFF ──────────────────────────────────────────────────────
  // Keep this block intact. Re-enable before deploy:
  //
  //   const session = await auth();
  //   const email = session?.user?.email ?? null;
  //   if (!session) redirect("/auth/signin?callbackUrl=/admin");
  //   if (!isAdmin(email)) {
  //     return (
  //       <main className="flex min-h-screen items-center justify-center bg-bg p-8 text-fg">
  //         <div className="max-w-md border border-border bg-surface p-8 text-center">
  //           <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-bear">⊘ unauthorized</div>
  //           <h1 className="mt-3 font-display text-3xl tracking-tightest">Cockpit is admin-only.</h1>
  //           <p className="mt-3 text-sm text-fg-dim">
  //             You're signed in as <span className="text-fg">{email}</span>, but this email
  //             isn't on the admin allow-list. Ask the founder to add it to{" "}
  //             <code className="bg-bg px-1 py-0.5 text-bull">ADMIN_EMAILS</code>.
  //           </p>
  //           <div className="mt-6 flex items-center justify-center gap-2">
  //             <a href="/" className="border border-border bg-bg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg">← home</a>
  //             <a href="/api/auth/signout" className="border border-border bg-bg px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bear hover:text-bear">sign out</a>
  //           </div>
  //         </div>
  //       </main>
  //     );
  //   }
  // ──────────────────────────────────────────────────────────────────────

  const email = "dev@lazybull.local";

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
          style={{ background: "radial-gradient(circle, rgba(46,232,165,0.10) 0%, transparent 70%)", filter: "blur(120px)" }}
        />
        <div
          className="absolute right-0 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 70%)", filter: "blur(140px)" }}
        />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-grid opacity-30" />

      <div className="relative z-10 flex flex-col">
        <CockpitTopBar admin={email} />

        {/* Page hero — mission-control headline */}
        <header className="mx-auto w-full max-w-[1600px] px-5 pt-8 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
                lazybull · platform · prod
              </div>
              <h1 className="mt-2 font-display text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[0.9] tracking-tightest text-fg">
                Cockpit<span className="text-bull">.</span>
              </h1>
              <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-fg-dim">
                Every paper trade, every teacher token, every kill switch — in one window.
                You're the only person who sees this.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
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
        <footer className="mx-auto w-full max-w-[1600px] border-t border-border px-5 py-4 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              <span className="text-bull">cockpit · ok</span>
              <span className="text-fg-faint">·</span>
              <span>data refreshes once per minute · seeded</span>
            </div>
            <div className="flex items-center gap-3">
              <span>signed in as <span className="text-fg">{email}</span> <span className="ml-2 border border-amber/40 bg-amber/5 px-1.5 py-0.5 text-amber">auth · off</span></span>
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
