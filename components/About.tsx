"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { PillLink, SectionHeading, Stats } from "@/components/calm/kit";

const ease = [0.22, 1, 0.36, 1] as const;

// WHO DID WHAT, checkable against the commit history.
//
// The 2026-09 diligence memo, verbatim: "Team: Warm bios, 'cold brews per
// week' stats, no credentials, one builder. Replace whimsy with proof: what
// each person shipped, with dates."
//
// So the stats are facts a reader could verify from `git log` and nothing
// else. What the history actually supports, as of Sep 2026:
//   • Shaurya authored 194 of 211 commits, May–Sep 2026 — the pricing engine,
//     the order engine, the market-data layer, the on-device models and the
//     security hardening.
//   • Joshmann authored the About page (May 2026) and the Pro voice co-pilot
//     (Jul 2026). Product, design and brand are his ROLE; the engineering the
//     old copy attributed to him is not in the history, so it is not claimed.
//   • Pratham has no commits. Ops, research and the roadmap are real work and
//     are named as such — no invented interview counts, no user counts.
// Two rules for anyone editing this: never add a number you cannot point at,
// and never attribute code to someone the log does not.
const FOUNDERS = [
  {
    src: "/shaurya.jpg",
    name: "Shaurya Negi",
    role: "Co-founder · Originator",
    bio: "Shaurya is where lazybull started, and he has written most of it. A CS student teaching himself derivatives on the side, he kept watching friends lose money on options trades they didn’t fully understand — and decided the interfaces, not the people, were broken.",
    longBio: "The whole thing began with Shaurya sketching a drag-to-build options chain on the back of a notebook. Between May and September 2026 he authored 194 of the repository's 211 commits: the Black-Scholes pricing engine and the Greeks math, the order engine behind the paper account, the market-data layer, the on-device quant models, and the security hardening pass across the API routes.",
    achievements: [
      "Originated the drag-to-build chain concept",
      "Wrote the pricing engine and the Greeks math",
      "Wrote the order engine behind the $5k paper account",
      "Wrote the market-data layer and the on-device models",
      "Ran the security-hardening pass across the API routes",
    ],
    stats: [
      { k: "Commits authored", v: "194 / 211" },
      { k: "Shipped", v: "May–Sep 2026" },
      { k: "Owns", v: "pricing · orders · data" },
    ],
    tag: "Idea · Math · Engine",
    quote: "Options aren’t actually complicated. The interfaces made them complicated. I just wanted something that showed me the truth.",
  },
  {
    src: "/joshmann.jpg",
    name: "Joshmann Singh",
    role: "Co-founder · Product",
    bio: "Joshmann owns product and design. He shipped the page you are reading in May 2026, and the Pro voice co-pilot in July — the two pieces of the product with his name on the commits.",
    longBio: "When Shaurya showed him the first scrappy chain mockup, Joshmann saw the product hiding inside it. His shipped work is this About page (May 2026) and the voice co-pilot on /pro (July 2026); the rest of his contribution is the part a repository does not record — the product decisions, the visual language and the argument about what a stranger should see first.",
    achievements: [
      "Shipped this About page — May 2026",
      "Shipped the Pro voice co-pilot — July 2026",
      "Owns product direction, design and brand",
      "Argued the case for the drag-first chain",
      "Sets what a first-time visitor sees, and in what order",
    ],
    stats: [
      { k: "Shipped", v: "May & Jul 2026" },
      { k: "Built", v: "voice co-pilot" },
      { k: "Owns", v: "product · design" },
    ],
    tag: "Product · Design · Front-end",
    quote: "Shaurya brought the idea. My job was to make sure that on day one, a stranger could open it and just get it.",
  },
  {
    // No photo on file yet — public/pratham.jpg does not exist, and pointing at
    // it made every /about load fire a 400 from the image optimizer before
    // falling back. Leave undefined so the initials card renders directly.
    src: undefined,
    name: "Pratham Verma",
    role: "Co-founder · Operations",
    bio: "Pratham writes none of the code and owns everything around it: operations, research, and the roadmap that decides what the other two build next.",
    longBio: "Pratham's work does not appear in the commit log, which is the honest way to describe it — he owns operations, the research behind what gets built, and the roadmap. The paper-only rule and the safety rails that come with it are a company decision before they are an engineering one, and that decision is his to argue for.",
    achievements: [
      "Owns operations, research and the roadmap",
      "Decides what gets built next, and what does not",
      "Holds the paper-only rule against every argument to relax it",
      "Runs the early-access programme",
      "No commits — and that is the role, not a gap",
    ],
    stats: [
      { k: "Owns", v: "ops · research" },
      { k: "Writes", v: "roadmap & specs" },
      { k: "Joined", v: "2026" },
    ],
    tag: "Ops · Strategy · Research",
    quote: "A great prototype isn’t a company. My job was to turn what Shaurya and Joshmann built into something traders could actually rely on.",
  },
];

const TIMELINE = [
  {
    date: "Early 2026",
    label: "The spark",
    desc: "Shaurya sketches a drag-to-build options chain on a whiteboard after watching friends lose money on trades they didn’t understand.",
  },
  {
    date: "2026",
    label: "Joshmann shapes it",
    desc: "Joshmann takes over product and design, and the rough idea starts to look like something a stranger could open.",
  },
  {
    date: "2026",
    label: "First prototype",
    desc: "Visual chain, live Greeks, and a working paper-trade flow come together for a tiny circle of early testers.",
  },
  {
    date: "2026",
    label: "Pratham joins",
    desc: "Pratham turns scattered docs into a real roadmap. The paper-only rule, the safety rails and the research all get an owner.",
  },
  {
    date: "2026",
    label: "On-device AI",
    desc: "The AI teacher and the on-device quant models ship — Greeks and IV computed and explained in your own browser, with nothing leaving it.",
  },
  {
    date: "Now",
    label: "Pre-soft-launch",
    desc: "Three founders, one mission: a full pro workspace, quant tools, safety rails, and an AI teacher for every Greek. Getting ready to open the doors.",
  },
];

const VALUES = [
  {
    label: "Radical clarity",
    desc: "If a 16-year-old can’t understand it, we haven’t explained it well enough. Every Greek, every risk metric — in plain English.",
  },
  {
    label: "Risk first",
    desc: "Every feature ships with a kill switch. We protect capital before we chase profit. Training wheels are a feature, not a crutch.",
  },
  {
    label: "No gatekeeping",
    desc: "Options were locked behind jargon for 50 years. Wall Street liked it that way. We’re unlocking the door — permanently.",
  },
  {
    label: "Speed obsession",
    desc: "0.4ms chain pricing isn’t a feature — it’s a floor. Slow data is bad data. Slowness is disrespect for the trader.",
  },
];

const COUNTERS = [
  { label: "Chain latency", value: 0, suffix: "ms", display: "0.4ms", raw: true },
  { label: "Quant bots", value: 27, suffix: "", display: "27" },
  { label: "Trained models", value: 13, suffix: "", display: "13" },
  { label: "To start", value: 0, suffix: "", display: "$0", raw: true },
];

function Counter({
  target,
  suffix,
  display,
  raw,
}: {
  target: number;
  suffix: string;
  display: string;
  raw?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView || raw) return;
    const duration = 1600;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.floor(eased * target));
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    let raf = requestAnimationFrame(animate);
    // Cancel on unmount rather than counting up into a dead component.
    return () => cancelAnimationFrame(raf);
  }, [inView, target, raw]);

  const formatted = raw
    ? display
    : target >= 1000000
    ? `${(count / 1000000).toFixed(count < 1000000 ? 0 : 1)}M${suffix}`
    : target >= 1000
    ? `${(count / 1000).toFixed(count < 1000 ? 0 : 0)}k${suffix}`
    : `${count}${suffix}`;

  // 4vw divides by --ui-zoom so the numeral stays sized to its column, not the zoomed viewport.
  return (
    <div ref={ref} className="font-display text-[clamp(2.5rem,calc(4vw/var(--ui-zoom)),4.5rem)] leading-none tracking-tightest text-fg">
      {formatted}
    </div>
  );
}

function FounderPhoto({ src, name }: { src?: string; name: string }) {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative aspect-3/4 overflow-hidden rounded-[14px] bg-surface-2">
      {errored || !src ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[clamp(5rem,12vw,9rem)] leading-none tracking-tightest text-fg-faint">
            {initials}
          </span>
        </div>
      ) : (
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover object-top grayscale"
          sizes="(max-width: 768px) 100vw, 50vw"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

function FounderFile({ f }: { f: (typeof FOUNDERS)[number] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border-soft pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="calm-link w-full justify-between"
      >
        <span>{open ? "Show less" : "Show more"}</span>
        <span aria-hidden className={open ? "rotate-90" : undefined}>
          ›
        </span>
      </button>

      {open && (
        <div className="mt-5 flex flex-col gap-6">
          {/* Achievements */}
          <ul className="space-y-2.5 text-[0.875rem] leading-relaxed text-fg-dim">
            {f.achievements.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span aria-hidden className="shrink-0 text-fg-faint">
                  ›
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* What the commit history supports: plain rows, some of the values are words. */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.875rem]">
            {f.stats.map((s) => (
              <div key={s.k} className="contents">
                <dt className="text-fg-faint">{s.k}</dt>
                <dd className="text-fg">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ item }: { item: (typeof TIMELINE)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    // A row beside the rail, one panel round the lot: a panel each was six
    // lit boxes zigzagging down the page.
    <div ref={ref} className="relative grid grid-cols-[auto_1fr] items-start gap-5">
      {/* Rail dot */}
      <div className="flex flex-col items-center pt-1">
        <motion.div
          className="z-10 size-3 rounded-full border-2 border-brand-ink bg-bg"
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, ease, delay: 0.2 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease, delay: 0.1 }}
      >
        <div className="text-[0.8125rem] text-fg-faint">{item.date}</div>
        <div className="mt-1 font-display text-xl tracking-tightest text-fg">{item.label}</div>
        <p className="mt-1.5 t-body-sm text-fg-dim">{item.desc}</p>
      </motion.div>
    </div>
  );
}

export function About() {
  return (
    <div className="flex flex-col overflow-x-clip text-fg">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      {/* Calm (S1, 2026-11-09): the kit's header shape. Gone: the breadcrumb
          tape ("Section / About · lazybull.us"), the grid, the boxed mono caps
          "the team" chip and its pulsing dot. The H1 still paints whole from
          the server HTML and rises out of a blur in CSS (matter-rise: transform
          and filter only, never opacity), so LCP does not wait for hydration. */}
      <section className="relative overflow-hidden">
        <div className="relative shell pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(3.5rem,8vw,6rem)]">
          <div className="matter-rise max-w-4xl">
            <div className="t-eyebrow text-brand-ink">The team</div>
            <h1 className="mt-4 t-display text-fg">
              The minds
              <br />
              behind the <span className="t-accent">bull.</span>
            </h1>
            <p className="mt-8 measure text-balance text-base leading-relaxed text-fg-dim md:text-lg">
              lazybull is built by three students who think options are made{" "}
              <span className="text-fg">artificially complex</span>, and that a
              beginner who can see a position is a beginner far less likely to
              be on the wrong side of it. Paper only, while we prove it.
            </p>
          </div>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────────────────────────────── */}
      {/* Calm (S1): two calm panels, the problem and the fix. It was a fake
          editor window (traffic lights, "mission.md", a pulsing "live" that was
          live with nothing) in mono caps, and its last line claimed pricing
          "faster than any retail platform on earth", a superlative nobody can
          check. */}
      <section className="relative">
        <motion.div
          className="relative shell grid grid-cols-1 gap-4 pb-[clamp(4rem,9vw,6rem)] md:grid-cols-2"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease }}
        >
          <div className="calm-panel p-8 md:p-10">
            <i aria-hidden className="lit-aura" />
            <div className="t-eyebrow text-fg-faint">The problem</div>
            <p className="mt-5 font-display text-2xl leading-snug tracking-tightest text-fg md:text-3xl">
              “Options platforms were designed by banks, for banks. Retail traders were an afterthought, or worse, the
              product.”
            </p>
            <div className="mt-6 text-[0.875rem] text-fg-faint">Shaurya Negi, co-founder</div>
          </div>
          <div className="calm-panel p-8 md:p-10">
            <i aria-hidden className="lit-aura" />
            <div className="t-eyebrow text-fg-faint">The fix</div>
            <ul className="mt-5 space-y-4 text-[1rem] leading-relaxed text-fg-dim">
              {[
                "See the options chain as a heatmap, and drag it to build a strategy",
                "An AI teacher that explains every Greek and every risk in plain English",
                "Safety rails, a kill switch and a $5k paper account, on by default",
                "Black-Scholes pricing that runs in your browser as you drag",
              ].map((text) => (
                <li key={text} className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 shrink-0 text-fg-faint">
                    ›
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 text-[0.875rem] text-fg-faint">Before the soft launch</div>
          </div>
        </motion.div>
      </section>

      {/* ── FOUNDERS ─────────────────────────────────────────────────────── */}
      {/* Calm (S1): three glass cards straight on the page's aura. Gone: the
          "Section 01" tape and "// team.md", the FILE 01 / 03 strip, the corner
          brackets, each founder's own accent colour, the scanlines over the
          photo and the handle footer. */}
      <section className="relative">
        <div className="relative shell pb-[clamp(4rem,9vw,6rem)]">
          <SectionHeading eyebrow="Founders" title="Three builders, one obsession." className="mb-10" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FOUNDERS.map((f, fi) => (
              <motion.article
                key={f.name}
                className="calm-panel flex flex-col gap-6 p-6 md:p-8"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease, delay: fi * 0.15 }}
              >
                <i aria-hidden className="lit-aura" />

                {/* Photo */}
                <motion.div
                  whileHover={{ scale: 1.015 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <FounderPhoto src={f.src} name={f.name} />
                </motion.div>

                {/* Name + role */}
                <div>
                  <div className="t-label text-fg-faint">{f.tag}</div>
                  <h3 className="mt-1 font-display text-4xl leading-[0.95] tracking-tightest text-fg">
                    {f.name}
                  </h3>
                  <div className="mt-2 text-[0.875rem] text-fg-dim">{f.role}</div>
                </div>

                {/* Bio */}
                <p className="t-body-sm text-fg-dim max-w-[44ch]">{f.bio}</p>

                {/* Quote */}
                <blockquote className="font-display text-lg leading-snug text-fg-dim">
                  “{f.quote}”
                </blockquote>

                {/* Achievements and the checkable facts, behind a disclosure */}
                <FounderFile f={f} />
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── BY THE NUMBERS ───────────────────────────────────────────────── */}
      {/* Calm (S1): one panel of figures on the kit's stat row. It was a tinted
          band with a blur orb and a hairline grid of tiles, a mint tick under
          each number. */}
      <section className="relative">
        <div className="relative shell pb-[clamp(4rem,9vw,6rem)]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <SectionHeading eyebrow="The build" title="The bull, by the numbers." />
          </motion.div>

          <motion.div
            className="calm-panel mt-10 p-8 md:p-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
          >
            <i aria-hidden className="lit-aura" />
            <Stats
              className="justify-between"
              items={COUNTERS.map((c) => ({
                label: c.label,
                value: <Counter target={c.value} suffix={c.suffix} display={c.display} raw={c.raw} />,
              }))}
            />
          </motion.div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative shell grid grid-cols-1 gap-10 pb-[clamp(4rem,9vw,6rem)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <SectionHeading eyebrow="Story" title="How we got to here." />
          </motion.div>

          {/* Timeline */}
          <div className="calm-panel p-6 md:p-8">
            <i aria-hidden className="lit-aura" />
            <div className="relative">
              {/* Rail line, down the centre of the dot column */}
              <div className="absolute bottom-2 left-1.5 top-2 w-px -translate-x-1/2 bg-border-soft" />

              <div className="flex flex-col gap-8">
                {TIMELINE.map((item) => (
                  <TimelineItem key={item.label} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative shell pb-[clamp(4rem,9vw,6rem)]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <SectionHeading eyebrow="Values" title="What we believe when the market opens." />
          </motion.div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.label}
                className="calm-panel p-8"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.1 }}
              >
                <i aria-hidden className="lit-aura" />
                <h3 className="font-display text-2xl tracking-tightest text-fg">{v.label}</h3>
                <p className="mt-2 t-body-sm text-fg-dim max-w-[44ch]">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative shell pb-[clamp(4rem,9vw,6rem)]">
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="t-eyebrow text-brand-ink">Hiring · remote · equity</div>

            <h2 className="t-display text-fg max-w-3xl">
              Join the
              <br />
              <span className="t-accent">bull.</span>
            </h2>

            <p className="measure text-base leading-relaxed text-fg-dim">
              We’re a small team with an outsized mission. If you believe retail
              traders deserve better tools, we want to hear from you.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <PillLink href="/trade" kind="primary">
                Try the platform free
              </PillLink>
              {/* hello@lazybull.us — the address /privacy, /terms, /safety and
                  /account already publish. The team@ address this replaced was
                  on a domain that does not resolve, so every mail sent from
                  this button bounced. A plain anchor spelling out the kit's
                  secondary pill: it leaves the site, so it is not a route. */}
              <a
                href="mailto:hello@lazybull.us"
                className="calm-pill-secondary inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[0.9375rem] font-medium tracking-[-0.01em] text-fg transition-[transform,box-shadow,background-color,color] duration-300 [transition-timing-function:var(--ease-settle)] hover:-translate-y-px"
              >
                Work with us
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
