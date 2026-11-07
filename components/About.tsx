"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";

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
    no: "01",
    src: "/shaurya.jpg",
    name: "Shaurya Negi",
    handle: "shaurya.negi",
    role: "Co-Founder · Originator",
    code: "FOUNDER-IDEA",
    color: "var(--cyan)",
    borderClass: "border-cyan/30",
    glowBg: "rgba(56,132,255,0.08)",
    bio: "Shaurya is where lazybull started, and he has written most of it. A CS student teaching himself derivatives on the side, he kept watching friends lose money on options trades they didn't fully understand — and decided the interfaces, not the people, were broken.",
    longBio: "The whole thing began with Shaurya sketching a drag-to-build options chain on the back of a notebook. Between May and September 2026 he authored 194 of the repository's 211 commits: the Black-Scholes pricing engine and the Greeks math, the order engine behind the paper account, the market-data layer, the on-device quant models, and the security hardening pass across the API routes.",
    achievements: [
      { icon: "✦", text: "Originated the drag-to-build chain concept" },
      { icon: "◈", text: "Wrote the pricing engine and the Greeks math" },
      { icon: "▲", text: "Wrote the order engine behind the $5k paper account" },
      { icon: "◎", text: "Wrote the market-data layer and the on-device models" },
      { icon: "⬡", text: "Ran the security-hardening pass across the API routes" },
    ],
    stats: [
      { k: "Commits authored", v: "194 / 211" },
      { k: "Shipped", v: "May–Sep 2026" },
      { k: "Owns", v: "pricing · orders · data" },
    ],
    tag: "Idea · Math · Engine",
    quote: "Options aren't actually complicated. The interfaces made them complicated. I just wanted something that showed me the truth.",
  },
  {
    no: "02",
    src: "/joshmann.jpg",
    name: "Joshmann Singh",
    handle: "joshmann.singh",
    role: "Co-Founder · Product",
    code: "FOUNDER-PRODUCT",
    color: "var(--bull)",
    borderClass: "border-bull/30",
    glowBg: "rgba(82,255,165,0.08)",
    bio: "Joshmann owns product and design. He shipped the page you are reading in May 2026, and the Pro voice co-pilot in July — the two pieces of the product with his name on the commits.",
    longBio: "When Shaurya showed him the first scrappy chain mockup, Joshmann saw the product hiding inside it. His shipped work is this About page (May 2026) and the voice co-pilot on /pro (July 2026); the rest of his contribution is the part a repository does not record — the product decisions, the visual language and the argument about what a stranger should see first.",
    achievements: [
      { icon: "✦", text: "Shipped this About page — May 2026" },
      { icon: "◈", text: "Shipped the Pro voice co-pilot — July 2026" },
      { icon: "▲", text: "Owns product direction, design and brand" },
      { icon: "◎", text: "Argued the case for the drag-first chain" },
      { icon: "⬡", text: "Sets what a first-time visitor sees, and in what order" },
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
    no: "03",
    // No photo on file yet — public/pratham.jpg does not exist, and pointing at
    // it made every /about load fire a 400 from the image optimizer before
    // falling back. Leave undefined so the initials card renders directly.
    src: undefined,
    name: "Pratham Verma",
    handle: "pratham.verma",
    role: "Co-Founder · Operations",
    code: "FOUNDER-OPS",
    color: "var(--plasma)",
    borderClass: "border-plasma/30",
    glowBg: "rgba(180,120,255,0.08)",
    bio: "Pratham writes none of the code and owns everything around it: operations, research, and the roadmap that decides what the other two build next.",
    longBio: "Pratham's work does not appear in the commit log, which is the honest way to describe it — he owns operations, the research behind what gets built, and the roadmap. The paper-only rule and the safety rails that come with it are a company decision before they are an engineering one, and that decision is his to argue for.",
    achievements: [
      { icon: "✦", text: "Owns operations, research and the roadmap" },
      { icon: "◈", text: "Decides what gets built next, and what does not" },
      { icon: "▲", text: "Holds the paper-only rule against every argument to relax it" },
      { icon: "◎", text: "Runs the early-access programme" },
      { icon: "⬡", text: "No commits — and that is the role, not a gap" },
    ],
    stats: [
      { k: "Owns", v: "ops · research" },
      { k: "Writes", v: "roadmap & specs" },
      { k: "Joined", v: "2026" },
    ],
    tag: "Ops · Strategy · Research",
    quote: "A great prototype isn't a company. My job was to turn what Shaurya and Joshmann built into something traders could actually rely on.",
  },
];

const TIMELINE = [
  {
    date: "Early 2026",
    label: "The Spark",
    desc: "Shaurya sketches a drag-to-build options chain on a whiteboard after watching friends lose money on trades they didn't understand.",
    color: "var(--cyan)",
    side: "left",
  },
  {
    date: "2026",
    label: "Joshmann Shapes It",
    desc: "Joshmann takes over product and design, and the rough idea starts to look like something a stranger could open.",
    color: "var(--bull)",
    side: "right",
  },
  {
    date: "2026",
    label: "First Prototype",
    desc: "Visual chain, live Greeks, and a working paper-trade flow come together for a tiny circle of early testers.",
    color: "var(--amber)",
    side: "left",
  },
  {
    date: "2026",
    label: "Pratham Joins",
    desc: "Pratham turns scattered docs into a real roadmap. The paper-only rule, the safety rails and the research all get an owner.",
    color: "var(--plasma)",
    side: "right",
  },
  {
    date: "2026",
    label: "On-device AI",
    desc: "The AI teacher and the on-device quant models ship — Greeks and IV computed and explained in your own browser, with nothing leaving it.",
    color: "var(--bull)",
    side: "left",
  },
  {
    date: "Now",
    label: "Pre-soft-launch",
    desc: "Three founders, one mission: a full pro workspace, quant tools, safety rails, and an AI teacher for every Greek. Getting ready to open the doors.",
    color: "var(--cyan)",
    side: "right",
  },
];

const VALUES = [
  {
    glyph: "◈",
    label: "Radical Clarity",
    desc: "If a 16-year-old can't understand it, we haven't explained it well enough. Every Greek, every risk metric — in plain English.",
    color: "var(--bull)",
  },
  {
    glyph: "⬡",
    label: "Risk First",
    desc: "Every feature ships with a kill switch. We protect capital before we chase profit. Training wheels are a feature, not a crutch.",
    color: "var(--bear)",
  },
  {
    glyph: "◎",
    label: "No Gatekeeping",
    desc: "Options were locked behind jargon for 50 years. Wall Street liked it that way. We're unlocking the door — permanently.",
    color: "var(--cyan)",
  },
  {
    glyph: "▣",
    label: "Speed Obsession",
    desc: "0.4ms chain pricing isn't a feature — it's a floor. Slow data is bad data. Slowness is disrespect for the trader.",
    color: "var(--amber)",
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

function FounderPhoto({
  src,
  color,
  name,
}: {
  src?: string;
  color: string;
  name: string;
}) {
  const [errored, setErrored] = useState(false);
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative overflow-hidden surface-card border border-border bg-surface-2 aspect-3/4">
      {errored || !src ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color}14 0%, transparent 60%)`,
          }}
        >
          <span
            className="font-display text-[clamp(5rem,12vw,9rem)] tracking-tightest leading-none"
            style={{ color }}
          >
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
      {/* Subtle tint overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(to top, ${color}22 0%, transparent 50%)` }}
      />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-15" />

      {/* Name badge — inset-6 keeps it clear of the corner brackets */}
      <div className="absolute inset-x-6 bottom-6">
        <div className="border border-border bg-bg/80 backdrop-blur-sm p-3">
          <div className="t-chrome text-fg-faint">
            // founder
          </div>
          <div className="mt-1 font-display text-xl tracking-tightest text-fg">
            {name}
          </div>
        </div>
      </div>

      <span className="absolute left-2 top-2 size-3 border-l-2 border-t-2" style={{ borderColor: color }} />
      <span className="absolute right-2 top-2 size-3 border-r-2 border-t-2" style={{ borderColor: color }} />
      <span className="absolute left-2 bottom-2 size-3 border-l-2 border-b-2" style={{ borderColor: color }} />
      <span
        className="absolute right-2 bottom-2 size-3 border-r-2 border-b-2"
        style={{ borderColor: color }}
      />
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
        className="flex w-full items-center justify-between t-chrome text-fg-faint transition-colors hover:text-fg"
      >
        <span>// {open ? "close" : "open"} file</span>
        <span style={{ color: f.color }}>{open ? "×" : "›"}</span>
      </button>

      {open && (
        <div className="mt-5 flex flex-col gap-6">
          {/* Achievements */}
          <div className="space-y-2">
            {f.achievements.map((a, i) => (
              <div key={i} className="flex items-start gap-3 group/item">
                <span
                  className="font-mono text-sm shrink-0 mt-0.5"
                  style={{ color: f.color }}
                >
                  {a.icon}
                </span>
                <span className="text-sm text-fg-dim group-hover/item:text-fg transition-colors">
                  {a.text}
                </span>
              </div>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
            {f.stats.map((s) => (
              <div key={s.k} className="min-w-0 bg-bg p-4">
                <div className="t-chrome text-fg-faint leading-tight">
                  {s.k}
                </div>
                <div
                  className="mt-2 font-display text-2xl tracking-tightest"
                  style={{ color: f.color }}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({
  item,
  i,
}: {
  item: (typeof TIMELINE)[0];
  i: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const isLeft = item.side === "left";

  return (
    // Single left rail below md; the alternating zigzag only exists from md up.
    <div ref={ref} className="relative grid grid-cols-[auto_1fr] items-start gap-6 md:grid-cols-[1fr_auto_1fr]">
      {/* Rail dot */}
      <div className="col-start-1 row-start-1 flex flex-col items-center pt-4 md:col-start-2">
        <motion.div
          className="size-3 rounded-full border-2 bg-bg z-10"
          style={{ borderColor: item.color }}
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, ease, delay: 0.2 }}
        />
      </div>

      {/* Card */}
      <motion.div
        className={`col-start-2 row-start-1 ${isLeft ? "md:col-start-1" : "md:col-start-3"}`}
        initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, ease, delay: 0.1 }}
      >
        <div className={`w-full surface-card border border-border bg-surface p-4 ${isLeft ? "md:text-right" : ""}`}>
          <div className="t-chrome text-fg-faint mb-2">
            {item.date}
          </div>
          <div
            className="font-display text-xl tracking-tightest mb-2"
            style={{ color: item.color }}
          >
            {item.label}
          </div>
          <p className="t-body-sm text-fg-dim">{item.desc}</p>
        </div>
      </motion.div>
    </div>
  );
}

export function About() {
  return (
    <div className="flex flex-col overflow-x-clip bg-bg text-fg">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="pointer-events-none absolute -left-60 top-0 h-150 w-150 rounded-full bg-bull/12 blur-[160px] drift" />

        {/* Tape */}
        <div className="relative flex items-center justify-between border-b border-border-soft px-5 py-1.5 t-eyebrow text-fg-faint">
          <div className="flex items-center gap-3">
            <span>⟢ Section / About</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">lazybull.us</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            <span>Founded 2026</span>
          </div>
        </div>

        <div className="relative shell section-y">
          {/* The H1 is this page's largest paint (on a phone, the paragraph
              under it is). Both sat in a motion entrance that started at
              opacity 0, so LCP waited for hydration and then the 0.8s fade
              (944ms at the Gate A2 review). The block now paints whole from
              the server HTML and rises out of a blur in CSS, the homepage
              headline's `matter-rise`: transform and filter only, never
              opacity, no wait for JS, and off under reduced motion
              (2026-11-06). */}
          <div className="matter-rise max-w-4xl">
            <div className="flex items-center gap-3 t-chrome mb-8">
              <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-2 py-1 text-bull">
                <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                the team
              </span>
            </div>

            <h1 className="t-display text-fg">
              The minds
              <br />
              behind the
              <br />
              <span className="t-accent phosphor">bull</span>
              <span className="text-bull">.</span>
            </h1>

            <p className="mt-8 measure text-balance text-base leading-relaxed text-fg-dim md:text-lg">
              lazybull is built by three students who think options are made{" "}
              <span className="text-fg">artificially complex</span>, and that a
              beginner who can SEE a position is a beginner far less likely to
              be on the wrong side of it. Paper only, while we prove it.
            </p>
          </div>
        </div>
      </section>

      {/* ── MISSION TERMINAL ─────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="relative shell section-y">
          <motion.div
            className="border border-border bg-bg"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease }}
          >
            {/* Terminal header */}
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-bear" />
                <span className="size-2.5 rounded-full bg-amber" />
                <span className="size-2.5 rounded-full bg-bull" />
                <span className="ml-3 t-chrome text-fg-dim">
                  mission.md — lazybull
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[0.625rem] text-fg-faint">
                <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                live
              </div>
            </div>

            <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
              <div className="border-b border-border p-8 md:border-b-0 md:border-r">
                <div className="t-chrome text-fg-faint mb-4">
                  // the problem
                </div>
                <p className="font-display text-2xl leading-snug tracking-tightest text-fg md:text-3xl">
                  "Options platforms were designed by banks, for banks. Retail traders were an{" "}
                  <span className="italic text-bear">afterthought</span> — or worse, the{" "}
                  <span className="italic text-bear">product</span>."
                </p>
                <div className="mt-6 font-mono text-[0.6875rem] text-fg-faint">
                  — Shaurya Negi, Co-Founder · Originator
                </div>
              </div>
              <div className="p-8">
                <div className="t-chrome text-fg-faint mb-4">
                  // the fix
                </div>
                <div className="space-y-4 font-mono text-[0.75rem] leading-relaxed text-fg-dim">
                  {[
                    { icon: "→", text: "Visualise the options chain as a heatmap you drag to build strategies" },
                    { icon: "→", text: "An AI teacher explains every Greek, every risk, in plain English" },
                    { icon: "→", text: "Safety rails, kill switches, and a $5k paper account — on by default" },
                    { icon: "→", text: "0.4ms Black-Scholes pricing — faster than any retail platform on earth" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-bull shrink-0 mt-0.5">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-border-soft pt-4 t-chrome text-fg-faint">
                  <span className="text-bull">STATUS:</span> PRE-SOFT-LAUNCH
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOUNDERS ─────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg">
        {/* Section header */}
        <div className="relative shell pt-24 pb-12">
          <div className="grid grid-cols-12 items-end gap-5">
            <div className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
              <span className="t-eyebrow text-fg-faint">
                ⟢ Section 01 / Founders
              </span>
              <span className="font-mono text-[0.6875rem] text-bull">// team.md</span>
            </div>
            <div className="col-span-12 md:col-span-9">
              <h2 className="t-title text-fg">
                Three builders,
                <br />
                <span className="t-accent text-fg-dim">
                  one{" "}
                  <span className="text-bull not-italic font-normal">obsession</span>.
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Founder cards */}
        <div className="relative shell pb-24">
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
            {FOUNDERS.map((f, fi) => (
              <motion.article
                key={f.no}
                className="group relative flex flex-col bg-bg transition-colors hover:bg-surface"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease, delay: fi * 0.15 }}
              >
                {/* Corner crosshairs */}
                <span className="absolute left-2 top-2 size-3 border-l border-t border-fg-faint" />
                <span className="absolute right-2 top-2 size-3 border-r border-t border-fg-faint" />
                <span className="absolute left-2 bottom-2 size-3 border-l border-b border-fg-faint" />
                <span className="absolute right-2 bottom-2 size-3 border-r border-b border-fg-faint" />

                {/* Header tape */}
                <div className="flex items-center justify-between border-b border-border-soft px-6 py-3 md:px-8">
                  <div className="flex items-center gap-3">
                    <span className="t-chrome text-fg-faint">
                      FILE
                    </span>
                    <span className="font-mono text-sm text-fg">
                      {f.no} / 03
                    </span>
                  </div>
                  <div
                    className="flex size-8 items-center justify-center border border-border bg-bg font-mono text-xs"
                    style={{ color: f.color }}
                  >
                    {f.no}
                  </div>
                </div>

                <div className="flex flex-col gap-6 p-6 md:p-8">
                  {/* Photo */}
                  <motion.div
                    whileHover={{ scale: 1.015 }}
                    transition={{ duration: 0.3, ease }}
                  >
                    <FounderPhoto
                      src={f.src}
                      color={f.color}
                      name={f.name}
                    />
                  </motion.div>

                  {/* Name + role */}
                  <div>
                    <div className="t-chrome text-fg-faint mb-1">
                      {f.tag}
                    </div>
                    <h3 className="font-display text-4xl leading-[0.95] tracking-tightest text-fg">
                      {f.name}
                    </h3>
                    <div
                      className="mt-1 font-mono text-sm uppercase tracking-wider"
                      style={{ color: f.color }}
                    >
                      {f.role}
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="t-body-sm text-fg-dim max-w-[44ch]">
                    {f.bio}
                  </p>

                  {/* Quote */}
                  <blockquote
                    className="border-l-2 pl-4 font-display text-lg italic leading-snug text-fg-dim"
                    style={{ borderColor: f.color }}
                  >
                    "{f.quote}"
                  </blockquote>

                  {/* Achievements + joke stats, behind the file disclosure */}
                  <FounderFile f={f} />

                  {/* Handle footer */}
                  <div className="flex items-center justify-between border-t border-border-soft pt-4 t-chrome text-fg-faint">
                    <span>@{f.handle}</span>
                    <span style={{ color: f.color }}>
                      {f.code} ›
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── BY THE NUMBERS ───────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute left-1/2 top-0 h-100 w-200 -translate-x-1/2 rounded-full bg-bull/8 blur-[120px]" />

        <div className="relative shell section-y">
          <motion.div
            className="flex flex-col gap-2 mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <span className="t-eyebrow text-fg-faint">
              ⟢ Section 02 / The build
            </span>
            <h2 className="t-title text-fg">
              The bull,
              <br />
              <span className="t-accent">by the numbers</span>.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
            {COUNTERS.map((c, i) => (
              <motion.div
                key={c.label}
                className="min-w-0 overflow-hidden bg-bg p-8 flex flex-col gap-3"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease, delay: i * 0.1 }}
              >
                <div className="t-chrome text-fg-faint">
                  {c.label}
                </div>
                <Counter
                  target={c.value}
                  suffix={c.suffix}
                  display={c.display}
                  raw={c.raw}
                />
                <div className="h-px w-8 bg-bull" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg">
        <div className="relative shell section-y">
          <motion.div
            className="flex flex-col gap-2 mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <span className="t-eyebrow text-fg-faint">
              ⟢ Section 03 / Story
            </span>
            <h2 className="t-title text-fg">
              How we got
              <br />
              <span className="t-accent text-fg-dim">
                to{" "}
                <span className="text-bull not-italic font-normal">here</span>.
              </span>
            </h2>
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            {/* Rail line — hugs the left dot column below md, centered from md up */}
            <div className="absolute left-1.5 top-0 bottom-0 w-px -translate-x-1/2 bg-border-soft md:left-1/2" />

            <div className="flex flex-col gap-10">
              {TIMELINE.map((item, i) => (
                <TimelineItem key={i} item={item} i={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="relative shell section-y">
          <motion.div
            className="grid grid-cols-12 items-end gap-5 mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <div className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
              <span className="t-eyebrow text-fg-faint">
                ⟢ Section 04 / Values
              </span>
              <span className="font-mono text-[0.6875rem] text-bull">// beliefs.md</span>
            </div>
            <div className="col-span-12 md:col-span-9">
              <h2 className="t-title text-fg">
                What we believe
                <br />
                <span className="t-accent text-fg-dim">
                  when the market{" "}
                  <span className="text-bear not-italic font-normal">opens</span>.
                </span>
              </h2>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <motion.div
                key={v.label}
                className="group relative flex flex-col gap-5 bg-bg p-8 transition-colors hover:bg-surface"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.1 }}
              >
                <div
                  className="flex size-12 items-center justify-center border border-border bg-bg font-mono text-2xl"
                  style={{ color: v.color }}
                >
                  {v.glyph}
                </div>

                <div>
                  <h3
                    className="font-display text-2xl tracking-tightest mb-2"
                    style={{ color: v.color }}
                  >
                    {v.label}
                  </h3>
                  <p className="t-body-sm text-fg-dim max-w-[38ch]">
                    {v.desc}
                  </p>
                </div>

                <div
                  className="h-px w-12 transition-all duration-500 group-hover:w-full"
                  style={{ background: v.color, opacity: 0.4 }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-bg">
        <div className="pointer-events-none absolute -right-20 top-1/2 h-125 w-125 -translate-y-1/2 rounded-full bg-bull/10 blur-[140px] drift" />

        <div className="relative shell section-y">
          <motion.div
            className="flex flex-col gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="flex items-center gap-2 t-chrome">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              <span className="text-bull">hiring · remote · equity</span>
            </div>

            <h2 className="t-display text-fg max-w-3xl">
              Join the
              <br />
              <span className="t-accent phosphor">bull</span>
              <span className="text-bull">.</span>
            </h2>

            <p className="measure text-base leading-relaxed text-fg-dim">
              We're a small team with an outsized mission. If you believe retail
              traders deserve better tools, we want to hear from you.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/trade"
                className="inline-flex items-center gap-3 bg-fg px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull"
              >
                Try the platform free
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6h10M6 1l5 5-5 5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </a>
              {/* hello@lazybull.us — the address /privacy, /terms, /safety and
                  /account already publish. The team@ address this replaced was
                  on a domain that does not resolve, so every mail sent from
                  this button bounced. */}
              <a
                href="mailto:hello@lazybull.us"
                className="inline-flex items-center gap-3 border border-border px-5 py-3.5 font-mono text-xs uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
              >
                Work with us →
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
