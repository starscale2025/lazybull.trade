import Link from "next/link";
import pkg from "../package.json";
import { ContrastToggle } from "./ContrastToggle";

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

// The subscribe callout belongs to the marketing story; app routes start the
// footer at the wordmark. The caller passes this rather than the footer reading
// usePathname, which would make every page's footer a client component.
export function Footer({ marketing = false }: { marketing?: boolean }) {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] backdrop-blur-[26px]">
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-[120%] -translate-x-1/2 rounded-full bg-bull/8 blur-[160px]" />

      {/* Top callout — marketing routes only; app routes start at the wordmark. */}
      {marketing && (
      <div className="relative shell border-b border-border-soft py-12">
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
            {/* NOT wired to anything yet — and until it is, this must not be
                allowed to SUBMIT. The form had no action and no onSubmit, and
                the button defaulted to
                type="submit", so pressing Subscribe fired a native GET at the
                current URL. On the homepage that full-reloads the page and
                replays the loader gate plus all 13,500px of the film from zero
                — the single most punishing thing any control on this site could
                do — and the address was discarded on the way.
                `type="button"` below stops that with no client boundary and no
                JavaScript. Whether we actually collect addresses is a product
                and privacy decision, not a styling one: wiring the real island
                and POST /api/subscribe is tracked as its own task. */}
            <form className="flex flex-col gap-2">
              <label className="t-chrome text-fg-faint">
                One email a week · a single new strategy explained
              </label>
              <div className="surface-card flex overflow-hidden border border-border bg-surface focus-within:border-bull">
                <span className="flex items-center px-3 font-mono text-sm text-bull">$</span>
                <input
                  type="email"
                  placeholder="learner@inbox.io"
                  className="flex-1 bg-transparent py-3.5 font-mono text-sm text-fg placeholder:text-fg-faint outline-none"
                />
                <button type="button" className="btn-primary-glass rounded-none px-5 font-mono text-xs font-semibold uppercase tracking-wider">
                  Subscribe →
                </button>
              </div>
              <p className="font-mono text-[10px] text-fg-faint">
                no upsells. one strategy per email. unsubscribe with <span className="text-bull">/quit</span>.
              </p>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* Massive wordmark — the italic-light "bull" with a gradient applied
          via background-clip: text WILL clip its rightward italic overhang
          unless the inline box explicitly extends past the glyph. The fix
          stack:
            • inline-block on the italic span so padding takes effect
            • padding-right: 0.22em — extends the gradient region past the
              second 'l's slanted top-right stroke
            • drop tracking-tightest (-0.05em letter-spacing) on the h2 — the
              negative spacing pulled the last 'l' inside its own box
            • margin-left on the period to clear the extended italic span */}
      <div className="relative shell overflow-visible pt-8">
        <div
          aria-hidden
          data-gsap="reveal-clip"
          data-gsap-duration="1.6"
          className="wonk-type select-none font-display leading-[0.82] text-fg"
          style={{
            fontSize: "clamp(3.5rem, 9vw, 7.5rem)",
            letterSpacing: "-0.02em",
            paddingRight: "0.3em",
            paddingBottom: "0.06em",
          }}
        >
          lazy
          <span
            className="t-accent inline-block headline-sweep"
            style={{ paddingLeft: "0.04em", paddingRight: "0.22em" }}
          >
            bull
          </span>
          <span
            className="text-bull crt-flicker inline-block"
            style={{ marginLeft: "-0.08em" }}
          >
            .
          </span>
        </div>
      </div>

      {/* Link columns */}
      <div
        data-gsap="stagger-fast"
        data-gsap-duration="0.8"
        className="relative shell grid grid-cols-2 gap-x-5 gap-y-10 py-10 md:grid-cols-6"
      >
        <div className="col-span-2">
          <div className="t-chrome text-fg-faint mb-4">
            Manifesto
          </div>
          <p className="font-display text-base leading-snug text-fg-dim">
            Options shouldn't be a guessing game.
            <br />
            <span className="italic">Make them visible. Make them safe.</span>
          </p>
          <div className="mt-6 flex items-center gap-2">
            {/* No accounts published yet — render as badges, not dead links. */}
            {["TW", "GH", "DC", "TG", "YT"].map((s) => (
              <span
                key={s}
                title="Coming soon"
                className="flex size-8 cursor-default items-center justify-center rounded-[10px] border border-border bg-bg t-chrome font-semibold text-fg-faint"
              >
                {s}
              </span>
            ))}
          </div>
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
              <p className="mt-4 cursor-default font-mono text-[11px] leading-relaxed text-fg-faint/70" title="Coming soon">
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
            {/* the graveyard easter egg moved into the About column — this row
                was clipping at 375px under the footer's overflow-hidden */}
          </div>
        </div>
      </div>

      {/* Disclaimer — confidently visible. Safety story is brand, not fine print.
          Capped at a readable measure (was a 150-char full-width line) and given
          right-side clearance so no floating control ever sits on legal text. */}
      <div className="relative border-t border-border bg-bg">
        <p className="mx-auto max-w-[90ch] px-5 py-5 pr-24 font-mono text-[11px] leading-relaxed text-fg-dim sm:pr-5">
          LAZYBULL is an educational platform for learning about options. We do
          not accept real funds, are not a registered broker-dealer, and do not
          provide investment advice. Paper-trading results are simulated using
          delayed market data and a Black-Scholes pricing model. Real options
          trading involves substantial risk and is not suitable for every investor.
        </p>
      </div>
    </footer>
  );
}
