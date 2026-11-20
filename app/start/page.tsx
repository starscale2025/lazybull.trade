import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { MarketHeatmap } from "@/components/start/MarketHeatmap";
import { SITE_DIRECTORY } from "@/lib/directory";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";

// /start: every page on the site in one place (owner, 2026-11-20), over a live
// map of the market. The home page's main button lands here. The links are the
// page; the map behind them is scenery with its reading spelled out in words.

export const metadata: Metadata = {
  title: "Start — lazybull",
  description: "Every page on lazybull in one place, over a live map of today's biggest US stocks.",
};

type Dest = { href: string; l: string; d: string };
const dir = Object.fromEntries(SITE_DIRECTORY.map((e) => [e.href, e])) as Record<string, (typeof SITE_DIRECTORY)[number]>;
const fromDir = (href: string): Dest => ({ href, l: dir[href].l, d: dir[href].d });

const PRIMARY: Dest[] = ["/learn", "/practice", "/trade", "/pro", "/quant", "/greeks"].map(fromDir);

const GROUPS: { title: string; links: Dest[] }[] = [
  {
    title: "Go deeper",
    links: [
      { href: "/trade/chain", l: "Visual chain", d: "the option chain, drawn" },
      { href: "/learn/bots", l: "All 27 bots", d: "each model's math, where it worked, where it broke" },
      { href: "/learn/broken-vwap", l: "Anatomy of a broken VWAP", d: "we shipped it wrong: the autopsy" },
      { href: "/practice/contest", l: "Weekly set", d: "this week's timed problems" },
      ...TRACK_ORDER.map((t) => ({ href: `/practice/tracks/${t}`, l: `${TRACK_META[t].label} track`, d: TRACK_META[t].blurb })),
      { href: "/practice/profile", l: "Practice ledger", d: "your solved ring, streak and certificate" },
    ],
  },
  {
    title: "Yours",
    links: [fromDir("/portfolio"), { href: "/account", l: "Account", d: "your sign-in, plan and data" }, fromDir("/pricing")],
  },
  {
    title: "About lazybull",
    links: [
      fromDir("/about"),
      { href: "/safety", l: "Safety", d: "the guard rails, and why paper only" },
      { href: "/graveyard", l: "The graveyard", d: "what didn't make it, buried honestly" },
      { href: "/terms", l: "Terms", d: "the rules of the site" },
      { href: "/privacy", l: "Privacy", d: "what we keep, and what we never do" },
    ],
  },
];

const card =
  "group relative flex flex-col rounded-2xl border border-[rgba(245,245,240,0.12)] bg-[rgba(5,5,5,0.74)] backdrop-blur-md transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_srgb,var(--brand)_55%,transparent)] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand)_25%,transparent),0_18px_50px_-24px_color-mix(in_srgb,var(--brand)_45%,transparent)]";

export default function StartPage() {
  return (
    <main className="tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      {/* The map is a dark screen in either theme: the section carries the dark tokens. */}
      <section
        data-theme="dark"
        aria-labelledby="start-title"
        className="relative isolate flex min-h-[calc(100svh-var(--nav-h))] flex-1 flex-col overflow-hidden bg-[#050505] text-fg"
      >
        <MarketHeatmap />

        <div className="shell relative z-10 w-full pb-28 pt-10 sm:pt-14">
          {/* The heading sits on the same glass as the cards, so no tile label runs through it. */}
          <header className="inline-block max-w-[40rem] rounded-2xl border border-[rgba(245,245,240,0.12)] bg-[rgba(5,5,5,0.74)] px-6 py-5 backdrop-blur-md">
            <p className="deck-eyebrow">Start here</p>
            <h1 id="start-title" className="deck-display mt-3 text-[clamp(2.4rem,5.4vw,4.25rem)] leading-[1] tracking-[-0.03em] text-[#f5f5f0]">
              Where to?
            </h1>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-[#cfcfc6]">
              Every page on lazybull, one click away. Behind them, today&rsquo;s biggest US stocks: sized by company,
              coloured by the day&rsquo;s move.
            </p>
          </header>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRIMARY.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className={`${card} h-full min-h-[7.5rem] p-5`}>
                  <span className="flex items-center justify-between">
                    <span className="deck-label">{dir[p.href].n}</span>
                    <span aria-hidden className="text-[#8a8a82] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-brand-ink">
                      →
                    </span>
                  </span>
                  <span className="deck-display mt-3 text-[1.5rem] leading-tight tracking-[-0.02em] text-[#f5f5f0]">{p.l}</span>
                  <span className="mt-1 text-[0.875rem] leading-snug text-[#b9b9b0]">{p.d}</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {GROUPS.map((g) => (
              <nav key={g.title} aria-label={g.title} className={`${card} p-5 hover:border-[rgba(245,245,240,0.12)] hover:shadow-none`}>
                <h2 className="deck-label text-[#9b9b92]">{g.title}</h2>
                <ul className="mt-2">
                  {g.links.map((x) => (
                    <li key={x.href} className="border-b border-[rgba(245,245,240,0.08)] last:border-b-0">
                      <Link href={x.href} className="group/row flex items-baseline justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-[0.9375rem] text-[#f5f5f0] transition-colors group-hover/row:text-brand-ink">{x.l}</span>
                          <span className="block truncate text-[0.75rem] text-[#9b9b92]">{x.d}</span>
                        </span>
                        <span aria-hidden className="shrink-0 text-[#6e6e66] group-hover/row:text-brand-ink">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <p className="mt-6 font-mono text-[0.6875rem] text-[#8a8a82]">Paper only · nothing here is advice · not SEBI-registered</p>
        </div>
      </section>
    </main>
  );
}
