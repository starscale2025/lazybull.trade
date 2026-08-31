import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PayoffSpine } from "./PayoffSpine";
import {
  GlassButton,
  GlassChip,
  GlassEyebrow,
  GlassHeading,
  GlassPoints,
  GlassSection,
} from "./GlassKit";

/**
 * The marketing recomposition — ui_kits/site-redesign rendered in
 * ui_kits/site-glass.
 *
 * Those two kits are the same proposal twice: identical sections, identical
 * order, identical copy. `site-redesign` is the flat cut and `site-glass` the
 * frosted evolution of it, so they are merged here rather than chosen
 * between. Where the glass pass had trimmed something the flat pass carried —
 * the per-step CTA, the third bullet on each feature, the chrome strip over
 * each screenshot — the flat version wins, because dropping those was
 * compression for a static preview, not a design decision.
 *
 * WHAT THIS DELIBERATELY DOES NOT TOUCH: the scroll cinema and the hero it
 * hands off to. app/page.tsx documents that GetStarted's opening block is
 * pixel-matched to the cinema's final overlay — that match is what makes the
 * collapse invisible. These sections mount BELOW it, so the film and the
 * hand-off render exactly as they did before.
 *
 * Server components throughout: hover lives in CSS (see GlassKit), so the
 * whole region adds no JavaScript to a page already carrying the cinema.
 */

/* ── 01 · The workflow ───────────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Learn",
    copy: "Zero to your first spread, in plain English. Fourteen chapters, eight live demos, one AI teacher over every Greek.",
    cta: "learn the greeks",
    href: "/learn#greeks",
  },
  {
    n: "02",
    title: "Backtest",
    copy: "Stage any of 27 bots on a year of tape. Walk-forward, no lookahead, verdicts written in English — not in Sharpe alone.",
    cta: "run a bot",
    href: "/quant",
  },
  {
    n: "03",
    title: "Paper trade",
    copy: "Drag the chain, see the payoff, place it on $5,000 of paper. Training wheels block unbounded risk until you say otherwise.",
    cta: "open the chain",
    href: "/trade",
  },
] as const;

function Workflow() {
  return (
    <GlassSection id="workflow">
      <div className="flex flex-col items-center text-center" data-gsap="fade-up">
        <GlassEyebrow>The workflow</GlassEyebrow>
        <GlassHeading accent="then trade it.">Learn it. Prove it —</GlassHeading>
      </div>

      <div className="relative mt-14">
        {/* The rule that threads the three step badges together. Decorative,
            and only drawn once the steps actually sit in a row. It wipes in
            left → right on scroll (two segments, staggered in reading order),
            so the spine of the argument is literally drawn before the three
            steps land on it — the section's one piece of choreography.
            Sibling of the grid rather than a child of it, so the stagger below
            cannot also grab it.
            TWO SEGMENTS, clipped to the inter-card gutters: the cards' glass
            fill is translucent, so one continuous rule stayed faintly visible
            crossing the card interiors and the 01/02/03 badges. The offsets
            derive from the grid: col = (100% - 2×1.125rem)/3, gap = 1.125rem
            (gap-4). */}
        <span
          aria-hidden
          data-gsap="reveal-clip"
          data-gsap-duration="0.55"
          className="absolute left-[calc(33.333%-0.75rem)] top-[3.3125rem] hidden h-px w-[1.125rem] bg-bull/35 md:block"
        />
        <span
          aria-hidden
          data-gsap="reveal-clip"
          data-gsap-duration="0.55"
          data-gsap-delay="0.55"
          className="absolute left-[calc(66.667%-0.375rem)] top-[3.3125rem] hidden h-px w-[1.125rem] bg-bull/35 md:block"
        />
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
          data-gsap="stagger"
          data-gsap-delay="0.25"
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="glass glass-hover specular relative flex flex-col gap-3.5 rounded-[var(--r-panel)] p-[30px_26px]"
            >
              <span className="glass inline-flex size-[2.875rem] items-center justify-center rounded-[14px] font-mono text-[0.8125rem] text-bull [text-shadow:0_0_14px_rgba(0,255,135,0.6)]">
                {s.n}
              </span>
              <span className="font-display text-[1.5625rem] tracking-[-0.03em] text-fg">
                {s.title}
              </span>
              <p className="m-0 flex-1 text-[0.8125rem] leading-[1.65] text-fg-dim">
                {s.copy}
              </p>
              <Link
                href={s.href}
                className="link-draw relative self-start t-eyebrow text-bull no-underline"
              >
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </GlassSection>
  );
}

/* ── 02 · The product ────────────────────────────────────────────────────── */

type Feature = {
  shot: string;
  strip: string;
  tag: string;
  href: string;
  title: string;
  accent: string;
  copy: string;
  points: readonly string[];
  /** Mirror the row so the screenshot sits on the right. */
  flip?: boolean;
};

const FEATURES: readonly Feature[] = [
  {
    shot: "/cinema/shots/trade.webp",
    strip: "02 · visual chain",
    tag: "visual chain",
    href: "/trade",
    title: "Drag a strike.",
    accent: "The payoff draws itself.",
    copy: "No leg tickets, no jargon wall. Click bids and asks straight off the chain; the risk curve, max loss and breakevens redraw as you go.",
    points: [
      "Black-Scholes mark, stated in the footer",
      "ATM ring and delta on every row",
      "Defined-risk vs unbounded, called out before you place",
    ],
  },
  {
    shot: "/cinema/shots/pro.webp",
    strip: "03 · pro terminal",
    tag: "pro terminal",
    href: "/pro",
    title: "A real desk,",
    accent: "minus the danger.",
    flip: true,
    copy: "Drawing tools, indicators, replay and alerts on live tape — every fill routed to the same paper account, never a broker.",
    points: [
      "Twelve drawing tools with shortcuts",
      "EMA · VWAP · Bollinger · RSI · MACD",
      "Session replay to re-trade any day",
    ],
  },
  {
    shot: "/cinema/shots/quant.webp",
    strip: "04 · quant workbench",
    tag: "quant workbench",
    href: "/quant",
    title: "27 bots.",
    accent: "Verdicts in English.",
    copy: "From SMA crossovers to a transformer on a year of bars. Every run states its tape, its folds and its confidence — teaching instruments, not track records.",
    points: [
      "13 trained models run in your browser",
      "Walk-forward, no lookahead",
      "Bring your own bot and backtest it",
    ],
  },
] as const;

function Features() {
  return (
    <GlassSection id="product">
      <div className="flex flex-col items-center text-center" data-gsap="fade-up">
        <GlassEyebrow>The product</GlassEyebrow>
        <GlassHeading accent="one terminal.">Three rooms,</GlassHeading>
      </div>

      <div className="mt-14 flex flex-col gap-6">
        {FEATURES.map((f) => (
          // Each row enters from the side its screenshot sits on, so the shot
          // leads and the copy follows it in.
          <div
            key={f.tag}
            data-gsap={f.flip ? "slide-left" : "slide-right"}
            className={`glass glass-hover specular grid items-center gap-8 rounded-[var(--r-panel)] p-6 lg:gap-8 ${
              f.flip ? "lg:grid-cols-[1fr_1.25fr]" : "lg:grid-cols-[1.25fr_1fr]"
            }`}
          >
            {/* The screenshot, framed like an instrument: a chrome strip that
                names the room, then the shot. Kept from the flat kit — an
                unlabelled screenshot on a marketing page is a stock photo.
                It also drifts ±20px against the copy column on scroll, which
                is what stops three full-width stills from reading as flat art
                pasted onto the page: the frame sits at its own depth. Travel is
                capped under the row's 26px padding so the frame can drift
                inside the card without ever touching its border. */}
            <div
              data-gsap="parallax"
              data-gsap-amount="40"
              className={`overflow-hidden rounded-[14px] border border-[var(--glass-border)] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)] ${
                f.flip ? "lg:order-2" : "lg:order-1"
              }`}
            >
              <div className="flex items-center gap-2 border-b border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-[0.4375rem]">
                <span className="t-chrome text-fg-faint">{f.strip}</span>
              </div>
              <Image
                src={f.shot}
                alt=""
                width={4800}
                height={3000}
                sizes="(min-width: 1024px) 640px, 100vw"
                className="block h-auto w-full"
              />
            </div>

            <div
              className={`flex flex-col gap-3.5 px-1 py-1.5 ${
                f.flip ? "lg:order-1" : "lg:order-2"
              }`}
            >
              <GlassChip className="self-start">{f.tag}</GlassChip>
              <h3 className="m-0 font-display text-[clamp(1.5rem,2.4vw,2.1rem)] leading-[1.02] tracking-[-0.03em] text-fg">
                {f.title} <span className="t-accent">{f.accent}</span>
              </h3>
              <p className="m-0 text-sm leading-[1.7] text-fg-dim">{f.copy}</p>
              <GlassPoints points={f.points} />
              <Link
                href={f.href}
                className="link-draw relative mt-1 self-start t-eyebrow text-bull no-underline"
              >
                open {f.tag} →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </GlassSection>
  );
}

/* ── 03 · Safety ─────────────────────────────────────────────────────────── */

const SAFETY = [
  [
    "$0 real money",
    "We do not accept funds. There is nothing to deposit and nothing to lose.",
  ],
  [
    "Training wheels on",
    "Unbounded-risk strategies are blocked by default. You turn that off, not us.",
  ],
  [
    "A kill switch under everything",
    "A daily loss cap watches every screen — the desk stops before a bad day compounds.",
  ],
  [
    "Honest data, labelled",
    "When the feed is simulated, the lamp says SIM. Synthetic chains say so on the tin.",
  ],
] as const;

function Safety() {
  return (
    <GlassSection id="safety">
      <div className="glass-strong specular grid items-center gap-10 rounded-[var(--r-panel)] p-8 lg:grid-cols-[5fr_7fr] lg:gap-14 lg:p-[56px_52px]">
        <div data-gsap="fade-up">
          <GlassEyebrow>Safety is the product</GlassEyebrow>
          <GlassHeading accent="by design.">Boring,</GlassHeading>
          <p className="measure mt-[1.125rem] mb-6 t-body-sm text-fg-dim">
            LAZYBULL is an educational platform. Not a broker, not advice — a
            place to get fluent before a single real dollar moves.
          </p>
          <GlassChip dot pulse>
            kill switch armed · paper-only
          </GlassChip>

          {/* The section asserts defined risk; this draws it. A capped payoff —
              flat at a loss you chose, up through zero, flat at a capped gain —
              strokes itself in on scroll. Wordless and aria-hidden on purpose:
              it is the argument as a shape, not another sentence to maintain,
              and it is the only place on this page where "options you can see"
              is demonstrated rather than claimed. */}
          <svg
            aria-hidden
            viewBox="0 0 260 92"
            className="mt-7 block h-auto w-full max-w-[16.25rem] overflow-visible"
          >
            {/* zero line */}
            <line
              x1="0"
              y1="58"
              x2="260"
              y2="58"
              stroke="var(--fg-faint)"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.5"
            />
            {/* the capped payoff itself */}
            <path
              d="M0 80 H88 L172 28 H260"
              fill="none"
              stroke="var(--bull)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              data-gsap="draw"
              data-gsap-duration="1.2"
              style={{ filter: "drop-shadow(0 0 8px rgba(0,255,135,0.45))" }}
            />
            {/* the floor you chose — the flat left leg, called out */}
            <line
              x1="0"
              y1="80"
              x2="88"
              y2="80"
              stroke="var(--bear)"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength={1}
              data-gsap="draw"
              data-gsap-duration="0.7"
              opacity="0.75"
            />
          </svg>
        </div>
        <div
          className="grid gap-3.5 sm:grid-cols-2"
          data-gsap="stagger-fast"
          data-gsap-delay="0.15"
        >
          {SAFETY.map(([t, d]) => (
            <div
              key={t}
              className="glass glass-hover rounded-[var(--r-cell)] p-[22px_20px]"
            >
              <div className="font-display text-[1.125rem] tracking-[-0.02em] text-fg">
                {t}
              </div>
              <p className="m-0 mt-2 text-[0.8125rem] leading-[1.6] text-fg-dim">
                {d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </GlassSection>
  );
}

/* ── 04 · Pricing ────────────────────────────────────────────────────────────
   Two tiers, not four. The full ladder (Free · Plus · Pro · Power) stays on
   /pricing — the landing's job is to say "free is real", not to sell a
   comparison table. Figures are the same source of truth as app/pricing:
   Pro is $39 monthly, $29/mo billed annually.                               */

type Tier = {
  name: string;
  price: string;
  unit: string;
  blurb: string;
  feats: readonly string[];
  cta: string;
  href: string;
  /** The condition attached to THIS price, if it has one. */
  terms?: string;
  kind: "primary" | "glass";
  /** The recommended tier — heavier glass, hot border, "most popular" chip. */
  hot?: boolean;
};

const TIERS: readonly Tier[] = [
  {
    name: "Free",
    price: "$0",
    unit: "/forever",
    blurb: "The whole primer. Real practice. Forever.",
    feats: [
      "Full 14-chapter interactive primer",
      "Unlimited paper trades · $5k account",
      "AI teacher · 5 explains per day",
      "3 bots in the quant workbench",
    ],
    cta: "start for free",
    href: "/learn",
    kind: "glass",
  },
  {
    name: "Pro",
    price: "$29",
    unit: "/mo",
    blurb: "The full workbench, nothing held back.",
    feats: [
      "All 27 bots + consensus engine",
      "Unlimited AI-teacher explains",
      "Bring-your-own-bot · hot-load & backtest",
      "Pro charting suite · shareable workspaces",
    ],
    cta: "join early access",
    terms: "billed annually · $39 monthly",
    href: "/auth/signin",
    kind: "primary",
    hot: true,
  },
] as const;

function Pricing() {
  return (
    <GlassSection id="pricing">
      <div className="flex flex-col items-center text-center" data-gsap="fade-up">
        <GlassEyebrow>Pricing</GlassEyebrow>
        <GlassHeading accent="Upgrade when it clicks.">Start free.</GlassHeading>
        <p className="mt-4 t-eyebrow text-fg-faint">cancel anytime</p>
      </div>

      <div
        className="mx-auto mt-13 grid max-w-[48.75rem] gap-5 sm:grid-cols-2"
        data-gsap="stagger"
        data-gsap-delay="0.1"
      >
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`specular glass-hover relative flex flex-col gap-4 rounded-[var(--r-panel)] p-[32px_30px] ${
              t.hot ? "glass-strong border-[var(--glass-border-hot)]" : "glass"
            }`}
          >
            {/* Not "most popular". This is a pre-revenue product whose own CTA
                says "join early access" — there is no popularity to report, and
                inventing one on the page that asks for money is the cheapest
                possible way to lose the trust the rest of this site works hard
                for. "everything unlocked" is checkable against the feature list
                directly beneath it. */}
            {t.hot && (
              <GlassChip className="absolute right-[1.125rem] top-[1.125rem]">
                everything unlocked
              </GlassChip>
            )}
            <div
              className={`t-eyebrow ${t.hot ? "text-bull" : "text-fg-faint"}`}
            >
              {t.name}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="t-data text-[2.875rem] leading-none tracking-[-0.03em] text-fg">
                {t.price}
              </span>
              <span className="t-chrome text-fg-faint">{t.unit}</span>
            </div>
            {/* The condition sits ON the number it qualifies. It used to be
                headered over BOTH cards, which put "billed annually · $39
                monthly" above a card that reads "$0 /forever" — a qualifier
                attached to the one price it cannot possibly describe. */}
            {t.terms && <div className="t-chrome text-fg-faint">{t.terms}</div>}
            <div className="font-display text-[1rem] text-fg-dim">
              {t.blurb}
            </div>
            <div className="flex-1">
              <GlassPoints points={t.feats} />
            </div>
            <GlassButton href={t.href} kind={t.kind} arrow>
              {t.cta}
            </GlassButton>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/pricing"
          className="link-draw relative t-eyebrow text-fg-dim no-underline hover:text-fg"
        >
          compare all four tiers →
        </Link>
      </div>
    </GlassSection>
  );
}

/* ── The region ──────────────────────────────────────────────────────────── */

export function MarketingSections() {
  return (
    // No border-t: the hero now ramps its background into var(--bg) at its own
    // bottom edge, and a 1px rule sitting on that ramp reinstated exactly the
    // hard line the ramp removes.
    <div className="relative isolate" data-payoff-track>
      {/* The one background the glass refracts: two phosphor orbs, one plasma,
          behind a masked grid. Scoped to this region rather than fixed to the
          viewport — the landing already runs a fixed orb layer above. */}
      {/* THE P&L SPINE. Sits above the aurora (z-0) and below every section
          (relative z-10), so it runs behind the whole region and the four
          sections read as four states of ONE curve rather than four unrelated
          layouts. Server component; the morph is a data attribute the global
          GsapScroller consumes, so this region still ships no client JS. */}
      <PayoffSpine />
      <div className="glass-aurora glass-aurora--melt-top" aria-hidden>
        <i className="a1" />
        <i className="a2" />
        <i className="a3" />
      </div>

      {/* Meet the hero at its own value. The hero paints an opaque bg, which
          occludes the root-level FIXED atmosphere; below the hero that
          atmosphere shows through again, so the boundary still carried a ~4-unit
          luminance step even after the hero ramped its own background out.
          This starts at var(--bg) — exactly the value the hero now ends on — and
          clears over 160px, so the two sides are continuous rather than merely
          close. Inside `isolate`, so it covers the fixed layer behind it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40"
        style={{ background: "linear-gradient(to bottom, var(--bg) 0%, transparent 100%)" }}
      />

      {/* The site navbar, picked up here rather than at the top of the page.
          The landing's no-navbar rule protects the cinema, not the whole
          document — so the bar arrives with the marketing region, once the
          film has handed off. Same component every other page mounts, so
          there is exactly one navbar on this site. */}
      <Nav />
      <Workflow />
      <Features />
      <Safety />
      <Pricing />
    </div>
  );
}
