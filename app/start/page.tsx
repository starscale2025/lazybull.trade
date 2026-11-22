import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { MarketCaption } from "@/components/start/MarketCaption";
import { StartStage } from "@/components/start/StartStage";
import { SITE_DIRECTORY } from "@/lib/directory";
import { TRACK_META, TRACK_ORDER } from "@/lib/practice/tracks";

// /start: every page on the site in one place (owner, 2026-11-20). The home
// page's main button lands here. The first screen is a stage
// (components/start/StartStage.tsx): the live market as a floor, a giant
// wordmark on the horizon and the six main pages circling it. Below it, the
// full index and the market's reading in words.

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
      { href: "/safety", l: "Safety", d: "the guard rails, and why they are there" },
      { href: "/graveyard", l: "The graveyard", d: "what didn't make it, buried honestly" },
      { href: "/terms", l: "Terms", d: "the rules of the site" },
      { href: "/privacy", l: "Privacy", d: "what we keep, and what we never do" },
    ],
  },
];

export default function StartPage() {
  return (
    <main className="tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <Nav />
      {/* The market is a dark screen in either theme: the section carries the dark tokens. */}
      <section data-theme="dark" aria-labelledby="start-title" className="relative flex-1 bg-[#050505] text-fg">
        <StartStage pods={PRIMARY} />

        {/* Every page, as one list in three groups: headings, names and what each
            is for. No boxes or divider lines; space does the grouping. Each
            group is a grid item that may shrink (min-w-0), so nothing runs off a
            phone's edge. */}
        <div id="index" className="shell relative scroll-mt-16 pb-16 pt-16">
          <h2 className="font-display text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-[#f5f5f0]">The full index</h2>
          <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-4">
            {GROUPS.map((g) => {
              const id = `index-${g.title.toLowerCase().replace(/\s+/g, "-")}`;
              // the long group takes two columns of its own, so the three end level
              const long = g.links.length > 6;
              return (
                <nav key={g.title} aria-labelledby={id} className={`min-w-0 ${long ? "lg:col-span-2" : ""}`}>
                  <h3 id={id} className="font-display text-[1.375rem] leading-tight tracking-[-0.01em] text-[#f5f5f0]">
                    {g.title}
                  </h3>
                  <ul className={`mt-5 grid gap-y-4 ${long ? "lg:grid-cols-2 lg:gap-x-14" : ""}`}>
                    {g.links.map((x) => (
                      <li key={x.href}>
                        <Link href={x.href} className="group/row block">
                          <span className="block">
                            <span className="block text-[1.0625rem] leading-snug text-[#f5f5f0] transition-colors group-hover/row:text-brand-ink">{x.l}</span>
                            <span className="mt-0.5 block text-[0.9375rem] leading-snug text-[#a9a99f]">{x.d}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              );
            })}
          </div>

          <div className="mt-14">
            <MarketCaption />
          </div>
          <p className="mt-4 text-[0.8125rem] text-[#8a8a82]">Paper only · nothing here is advice · not SEBI-registered</p>
        </div>
      </section>
    </main>
  );
}
