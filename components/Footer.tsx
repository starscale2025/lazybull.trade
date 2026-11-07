import Link from "next/link";
import pkg from "../package.json";
import { ContrastToggle } from "./ContrastToggle";
import { MotionToggle } from "./MotionToggle";
import { ConsentLink } from "./ConsentLink";

// Every entry here used to be href="#" — 32 links plus the three legal ones,
// all of which looked clickable and went nowhere. Unshipped items now collapse
// to a single muted `roadmap` line per column instead of padding the grid with
// dead "soon" rows.
type FooterLink = { label: string; href: string };
const COLS: { title: string; links: FooterLink[]; roadmap?: string }[] = [
  {
    title: "Product",
    links: [
      { label: "Visual chain", href: "/trade/chain" },
      { label: "Strategy builder", href: "/trade" },
      { label: "Greek surface", href: "/greeks" },
      { label: "Quant workbench", href: "/quant" },
      { label: "Pro charts", href: "/pro" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Practice problems", href: "/practice" },
      { label: "The three pieces", href: "/learn#three-pieces" },
      { label: "Greeks 101", href: "/learn#greeks" },
      { label: "The vol smile", href: "/learn#volsmile" },
      { label: "Probability · 3 ways", href: "/learn#probability" },
      { label: "The 5 families", href: "/learn#families" },
      { label: "Backtest in motion", href: "/learn#backtest" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "Bring your own bot", href: "/learn#byob" },
      { label: "The AI quants", href: "/learn#ai-quants" },
      { label: "Teacher mode", href: "/learn#teacher" },
    ],
    roadmap: "roadmap · api / docs / changelog — soon",
  },
  {
    title: "About",
    links: [
      { label: "Manifesto", href: "/about" },
      { label: "Now go", href: "/learn#now-go" },
      { label: "⚰ The graveyard", href: "/graveyard" },
    ],
    roadmap: "roadmap · press / brand kit / contact / status — soon",
  },
];

/**
 * SOCIAL LINKS, FROM THE ENVIRONMENT ONLY.
 *
 * The 2026-09 diligence memo: "No Discord, X, LinkedIn, YouTube, GitHub or
 * Product Hunt link anywhere on the site." What stood here instead was five
 * grey badges — TW, GH, DC, TG, YT — captioned "Coming soon", which is a
 * footer telling every visitor the company has no presence anywhere.
 *
 * These render ONLY when the matching env var holds a real URL, and NOTHING
 * renders when none is set, so this ships dark today and lights up the moment
 * an account exists — no code change, no dead link, and never a placeholder
 * for an account nobody has created.
 *
 * Written out one by one rather than looped over a dynamic key: NEXT_PUBLIC_*
 * is inlined at BUILD time by static substitution, so `process.env[name]` for
 * a computed `name` inlines to undefined and the whole column would silently
 * stay empty in production.
 *
 * `httpUrl` is not ceremony. These values arrive from deploy configuration,
 * and an href is one of the few places a string becomes executable — a
 * `javascript:` value in an anchor runs on click. Only http(s) survives.
 */
const httpUrl = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

const SOCIALS = (
  [
    { label: "X", name: "X (Twitter)", href: httpUrl(process.env.NEXT_PUBLIC_SOCIAL_X) },
    { label: "DC", name: "Discord", href: httpUrl(process.env.NEXT_PUBLIC_SOCIAL_DISCORD) },
    { label: "YT", name: "YouTube", href: httpUrl(process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE) },
    { label: "GH", name: "GitHub", href: httpUrl(process.env.NEXT_PUBLIC_SOCIAL_GITHUB) },
    { label: "IN", name: "LinkedIn", href: httpUrl(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN) },
    { label: "IG", name: "Instagram", href: httpUrl(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM) },
  ] as const
).filter((s): s is (typeof s) & { href: string } => s.href !== null);

// The subscribe callout belongs to the marketing story; app routes start the
// footer at the wordmark. The caller passes this rather than the footer reading
// usePathname, which would make every page's footer a client component.
export function Footer({ marketing = false }: { marketing?: boolean }) {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-[26px]">
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-[120%] -translate-x-1/2 rounded-full bg-bull/8 blur-[160px]" />

      {/* Top callout — marketing routes only; app routes start at the wordmark. */}
      {marketing && (
      <div className="relative shell border-b border-border-soft section-y-sm">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-8">
          <div className="col-span-12 lg:col-span-7">
            <p className="t-eyebrow text-fg-faint mb-4">
              ⟢ Last call
            </p>
            {/* h2, not h3: this is the first heading under the page h1, and every page on
                the site rendered h1 -> h3 -> h2 because of this pair. */}
            <h2 className="t-title text-fg">
              The chain is open.
              <br />
              <span className="t-accent">Drag something.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-5">
            {/* There was a newsletter form here that collected nothing: no
                action, no handler, and with a single email field pressing Enter
                still submitted it implicitly, a GET to "/?" that reloaded the
                page and restarted the film. Until a real subscribe route exists
                (rate-limited, with its own consent notice) the slot holds the
                one action the headline above asks for. */}
            <div className="flex flex-col gap-2">
              <Link
                href="/trade"
                className="btn-primary-glass inline-flex w-fit items-center gap-2 px-6 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider"
              >
                Open the strategy builder →
              </Link>
              <p className="font-mono text-[0.625rem] text-fg-faint">
                paper-only · $0 real money, ever
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* THE DISPLAY LINE IS THE MANIFESTO (Gate A2). This slot used to hold a
          9vw gradient wordmark with a shine sweeping across it: the brand's
          name, shouted, where its belief should be. The belief is the display
          line now, set in --fg like the H1 it answers, and the name sits small
          at the head of the columns below. */}
      <div className="relative shell overflow-visible pt-10">
        <p
          data-gsap="reveal-clip"
          data-gsap-duration="1.6"
          className="wonk-type font-display leading-[0.98] text-fg text-balance"
          style={{
            fontSize: "clamp(2.2rem, 4.2vw, 4.5rem)",
            letterSpacing: "-0.03em",
            paddingBottom: "0.08em",
          }}
        >
          Options shouldn&apos;t be a guessing game.
          <br />
          <span className="italic">Make them visible. Make them safe.</span>
        </p>
      </div>

      {/* Link columns */}
      <div
        data-gsap="stagger-fast"
        data-gsap-duration="0.8"
        className="relative shell grid grid-cols-2 gap-x-5 gap-y-10 py-10 md:grid-cols-6"
      >
        <div className="col-span-2">
          <div className="font-display text-3xl leading-none tracking-[-0.02em] text-fg">
            lazy<span className="italic">bull</span>
          </div>
          <p className="mt-3 font-display text-base leading-snug text-fg-dim">
            Options you can see.
          </p>
          {/* Nothing at all when no account is configured — an empty row says
              less than five badges saying "coming soon". See SOCIALS above. */}
          {SOCIALS.length > 0 && (
            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.name}
                  title={s.name}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-8 items-center justify-center rounded-[10px] border border-border bg-bg t-chrome font-semibold text-fg-faint transition-colors hover:border-bull hover:text-bull"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <div className="t-chrome text-fg-faint mb-4">
              {col.title}
            </div>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="group inline-flex items-center gap-2 font-mono text-sm text-fg-dim transition-colors hover:text-fg"
                  >
                    <span className="text-fg-faint group-hover:text-bull">›</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            {col.roadmap && (
              <p className="mt-4 cursor-default font-mono text-[0.6875rem] leading-relaxed text-fg-faint/70" title="Coming soon">
                {col.roadmap}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="relative border-t border-border bg-bg-soft">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-3 t-chrome text-fg-faint">
          <div className="flex items-center gap-3">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            <span className="text-bull">paper-only · pre-soft-launch</span>
            <span className="text-fg-faint">·</span>
            <span>v{pkg.version}</span>
            <span className="text-fg-faint">·</span>
            <ContrastToggle />
            <MotionToggle />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>© 2026 lazybull labs</span>
            <span className="text-fg-faint">·</span>
            {/* Real pages now — the Honesty Ledger (plain-English clauses, each
                with a what-this-means note). */}
            <Link href="/privacy" className="hover:text-fg">privacy</Link>
            <span className="text-fg-faint">·</span>
            <Link href="/terms" className="hover:text-fg">terms</Link>
            <span className="text-fg-faint">·</span>
            <Link href="/safety" className="hover:text-fg">safety</Link>
            <span className="text-fg-faint">·</span>
            {/* The withdrawal path. /privacy promises consent can be changed
                at any time, and DPDP requires it — a promise with no control
                behind it is the kind of thing diligence reads as theatre. */}
            <ConsentLink />
            {/* the graveyard easter egg moved into the About column — this row
                was clipping at 375px under the footer's overflow-hidden */}
          </div>
        </div>
      </div>

      {/* Disclaimer — confidently visible. Safety story is brand, not fine print.
          Capped at a readable measure (was a 150-char full-width line) and given
          right-side clearance so no floating control ever sits on legal text. */}
      <div className="relative border-t border-border bg-bg">
        <p className="mx-auto max-w-[90ch] px-5 py-5 pr-24 font-mono text-[0.6875rem] leading-relaxed text-fg-dim sm:pr-5">
          LAZYBULL is an educational platform for learning about options. We do
          not accept real funds, are not a registered broker-dealer, and are not
          registered with SEBI as an investment adviser or research analyst. Nothing
          here is investment advice or a recommendation to trade. Paper-trading
          results are simulated using delayed market data and a Black-Scholes
          pricing model. Real options trading involves substantial risk and is not
          suitable for every investor.
        </p>
      </div>
    </footer>
  );
}
