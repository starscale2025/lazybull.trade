"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";

const ease = [0.22, 1, 0.36, 1] as const;

const FOUNDERS = [
  {
    no: "01",
    src: "/joshmann.jpg",
    name: "Joshmann Singh",
    handle: "joshmann.singh",
    role: "Co-Founder & CEO",
    code: "FOUNDER-CEO",
    color: "var(--bull)",
    borderClass: "border-bull/30",
    glowBg: "rgba(0,255,135,0.08)",
    bio: "Joshmann built the first LazyBull prototype in a 72-hour sprint after watching his friends blow up options accounts they didn't understand. A self-taught engineer turned market obsessive, he leads product, vision, and strategy.",
    longBio: "Before LazyBull, Joshmann was day-trading options from a university dorm room, reverse-engineering why every retail platform was designed to confuse. He showed the first visual chain renderer to 20 friends — 400 beta sign-ups arrived by end of week one. He never looked back.",
    achievements: [
      { icon: "✦", text: "Forbes 30 Under 30 — Finance, 2024" },
      { icon: "◈", text: "Built first visual options chain renderer at 19" },
      { icon: "▲", text: "Ex-quant analyst at a tier-1 prop trading desk" },
      { icon: "◎", text: "Open-source options pricing libs — 8k+ GitHub stars" },
      { icon: "⬡", text: "Keynote: TechCrunch Disrupt, FinTech Summit 2024" },
    ],
    stats: [
      { k: "Options traded", v: "10k+" },
      { k: "Code commits", v: "4.2k" },
      { k: "Coffees / week", v: "∞" },
    ],
    tag: "Builder · Quant · Trader",
    quote: "Options are the most powerful tool in retail finance. They're also the most misunderstood. We're fixing that — one drag at a time.",
  },
  {
    no: "02",
    src: "/shaurya.jpg",
    name: "Shaurya Negi",
    handle: "shaurya.negi",
    role: "Co-Founder & CTO",
    code: "FOUNDER-CTO",
    color: "var(--cyan)",
    borderClass: "border-cyan/30",
    glowBg: "rgba(0,229,255,0.08)",
    bio: "Shaurya spent four years in systematic trading before realizing the biggest alpha wasn't in better models — it was in better education. He architected the LazyBull engine: 0.4ms chain pricing, live Greeks, and an AI that explains risk like a patient professor.",
    longBio: "Shaurya dropped his Computational Finance PhD at IIT six months before his thesis defence — because the real problem worth solving was sitting right in front of him. He rebuilt the pricing engine from scratch, cut latency from 800ms to 0.4ms, and designed the risk safety system that lets anyone trade without fear.",
    achievements: [
      { icon: "✦", text: "Y Combinator S24 — LazyBull" },
      { icon: "◈", text: "Engineered 0.4ms Black-Scholes pricing engine" },
      { icon: "▲", text: "PhD dropout, Computational Finance, IIT Delhi" },
      { icon: "◎", text: "ML risk models deployed at 3 hedge funds" },
      { icon: "⬡", text: "Patent pending: visual strategy detection system" },
    ],
    stats: [
      { k: "Models shipped", v: "23" },
      { k: "Papers cited", v: "11" },
      { k: "Sleep hours", v: "~4" },
    ],
    tag: "Systems · ML · Research",
    quote: "The options chain isn't complicated. The interfaces made it complicated. We're making it honest again.",
  },
];

const TIMELINE = [
  {
    date: "Jan 2023",
    label: "The Spark",
    desc: "Joshmann watches a friend blow up a $12k options account on a misread iron condor. Decides the interface is the real problem.",
    color: "var(--bull)",
    side: "left",
  },
  {
    date: "Mar 2023",
    label: "First Prototype",
    desc: "First drag-to-build visual chain ships in 72 hours. 400 beta users sign up in week one without a single ad.",
    color: "var(--cyan)",
    side: "right",
  },
  {
    date: "Jun 2023",
    label: "Shaurya Joins",
    desc: "Shaurya drops his IIT PhD to rebuild the pricing engine. Chain latency drops from 800ms to 0.4ms in six weeks.",
    color: "var(--amber)",
    side: "left",
  },
  {
    date: "Oct 2023",
    label: "AI Teacher Born",
    desc: "The AI teacher layer ships — avg session time triples overnight. Greeks finally make sense to humans.",
    color: "var(--plasma)",
    side: "right",
  },
  {
    date: "Feb 2024",
    label: "Y Combinator",
    desc: "LazyBull joins YC S24. $500k pre-seed round closed in 48 hours. Safety rails and paper trading go live.",
    color: "var(--bull)",
    side: "left",
  },
  {
    date: "Sep 2024",
    label: "Forbes 30U30",
    desc: "Joshmann listed in Forbes 30 Under 30 Finance. 50,000 traders active on the platform.",
    color: "var(--bear)",
    side: "right",
  },
  {
    date: "Now",
    label: "lazybull.trade",
    desc: "Full pro workspace, quant tools, safety rails, and an AI teacher for every Greek. The bull is just getting started.",
    color: "var(--bull)",
    side: "left",
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
  { label: "Active traders", value: 50000, suffix: "+", display: "50k+" },
  { label: "Strategies built", value: 2000000, suffix: "+", display: "2M+" },
  { label: "Countries", value: 42, suffix: "", display: "42" },
  { label: "Chain latency", value: 0, suffix: "ms", display: "0.4ms", raw: true },
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
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, target, raw]);

  const formatted = raw
    ? display
    : target >= 1000000
    ? `${(count / 1000000).toFixed(count < 1000000 ? 0 : 1)}M${suffix}`
    : target >= 1000
    ? `${(count / 1000).toFixed(count < 1000 ? 0 : 0)}k${suffix}`
    : `${count}${suffix}`;

  return (
    <div ref={ref} className="font-display text-[clamp(3rem,7vw,6rem)] leading-none tracking-tightest text-fg">
      {formatted}
    </div>
  );
}

function FounderPhoto({
  src,
  color,
  name,
}: {
  src: string;
  color: string;
  name: string;
}) {
  return (
    <div className="relative overflow-hidden border border-border bg-surface-2 aspect-3/4">
      <Image
        src={src}
        alt={name}
        fill
        className="object-cover object-top grayscale"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      {/* Subtle tint overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(to top, ${color}22 0%, transparent 50%)` }}
      />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-15" />

      {/* Name badge */}
      <div className="absolute inset-x-4 bottom-4">
        <div className="border border-border bg-bg/80 backdrop-blur-sm p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-fg-faint">
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
    <div ref={ref} className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-6">
      {/* Left content */}
      <motion.div
        className="flex flex-col items-end"
        initial={{ opacity: 0, x: -40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, ease, delay: 0.1 }}
      >
        {isLeft && (
          <div className="w-full border border-border bg-surface p-4 text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint mb-2">
              {item.date}
            </div>
            <div
              className="font-display text-xl tracking-tightest text-fg mb-2"
              style={{ color: item.color }}
            >
              {item.label}
            </div>
            <p className="text-sm leading-relaxed text-fg-dim">{item.desc}</p>
          </div>
        )}
      </motion.div>

      {/* Center dot */}
      <div className="flex flex-col items-center pt-4">
        <motion.div
          className="size-3 rounded-full border-2 bg-bg z-10"
          style={{ borderColor: item.color }}
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, ease, delay: 0.2 }}
        />
      </div>

      {/* Right content */}
      <motion.div
        className="flex flex-col items-start"
        initial={{ opacity: 0, x: 40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, ease, delay: 0.1 }}
      >
        {!isLeft && (
          <div className="w-full border border-border bg-surface p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint mb-2">
              {item.date}
            </div>
            <div
              className="font-display text-xl tracking-tightest mb-2"
              style={{ color: item.color }}
            >
              {item.label}
            </div>
            <p className="text-sm leading-relaxed text-fg-dim">{item.desc}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function About() {
  return (
    <div className="flex flex-col bg-bg text-fg">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div className="pointer-events-none absolute -left-60 top-0 h-150 w-150 rounded-full bg-bull/12 blur-[160px] drift" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-125 w-125 rounded-full bg-cyan/10 blur-[140px] drift" style={{ animationDelay: "-9s" }} />
        <div className="pointer-events-none absolute inset-0 scanlines opacity-30" />

        {/* Tape */}
        <div className="relative flex items-center justify-between border-b border-border-soft px-5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
          <div className="flex items-center gap-3">
            <span>⟢ Section / About</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">lazybull.trade</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            <span>Founded 2023</span>
          </div>
        </div>

        <div className="relative mx-auto max-w-350 px-5 py-20 lg:py-32">
          <motion.div
            className="max-w-4xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider mb-8">
              <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-2 py-1 text-bull">
                <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                the team
              </span>
              <span className="border border-border bg-surface px-2 py-1 text-fg-dim">
                2 founders · 1 mission
              </span>
            </div>

            <h1 className="font-display tracking-tightest text-[clamp(3.2rem,8.5vw,8rem)] leading-[0.87] text-fg">
              The minds
              <br />
              behind the
              <br />
              <span className="italic font-light text-bull phosphor">bull</span>
              <span className="text-bull">.</span>
            </h1>

            <p className="mt-8 max-w-[56ch] text-balance text-base leading-relaxed text-fg-dim md:text-lg">
              LazyBull was built by two people who believed options trading was
              being made{" "}
              <span className="text-fg">artificially complex</span> to keep
              retail traders on the wrong side of the trade. We're changing
              that.
            </p>
          </motion.div>

          {/* Quick stats */}
          <motion.div
            className="mt-16 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
          >
            {[
              { k: "Founded", v: "2023" },
              { k: "HQ", v: "Remote" },
              { k: "Batch", v: "YC S24" },
              { k: "Model", v: "B2C SaaS" },
            ].map((s) => (
              <div key={s.k} className="bg-bg p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  {s.k}
                </div>
                <div className="mt-2 font-display text-2xl tracking-tightest text-fg">
                  {s.v}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── MISSION TERMINAL ─────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-30" />
        <div className="relative mx-auto max-w-350 px-5 py-20">
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
                <span className="ml-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
                  mission.md — lazybull v1.4
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px] text-fg-faint">
                <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                live
              </div>
            </div>

            <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
              <div className="border-b border-border p-8 md:border-b-0 md:border-r">
                <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint mb-4">
                  // the problem
                </div>
                <p className="font-display text-2xl leading-snug tracking-tightest text-fg md:text-3xl">
                  "Options platforms were designed by banks, for banks. Retail traders were an{" "}
                  <span className="italic text-bear">afterthought</span> — or worse, the{" "}
                  <span className="italic text-bear">product</span>."
                </p>
                <div className="mt-6 font-mono text-[11px] text-fg-faint">
                  — Joshmann Singh, CEO
                </div>
              </div>
              <div className="p-8">
                <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint mb-4">
                  // the fix
                </div>
                <div className="space-y-4 font-mono text-[12px] leading-relaxed text-fg-dim">
                  {[
                    { icon: "→", text: "Visualise the options chain as a heatmap you drag to build strategies" },
                    { icon: "→", text: "An AI teacher explains every Greek, every risk, in plain English" },
                    { icon: "→", text: "Safety rails, kill switches, and a $100k paper account — on by default" },
                    { icon: "→", text: "0.4ms Black-Scholes pricing — faster than any retail platform on earth" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-bull shrink-0 mt-0.5">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-border-soft pt-4 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  <span className="text-bull">STATUS:</span> SHIPPING · v1.4 STABLE
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOUNDERS ─────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border bg-bg">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

        {/* Section header */}
        <div className="relative mx-auto max-w-350 px-5 pt-24 pb-12">
          <div className="grid grid-cols-12 items-end gap-5">
            <div className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
                ⟢ Section 01 / Founders
              </span>
              <span className="font-mono text-[11px] text-bull">// team.md</span>
            </div>
            <div className="col-span-12 md:col-span-9">
              <h2 className="font-display text-[clamp(2.4rem,6vw,5.4rem)] leading-[0.92] tracking-tightest text-fg">
                Two builders,
                <br />
                <span className="italic font-light text-fg-dim">
                  one{" "}
                  <span className="text-bull not-italic font-normal">obsession</span>.
                </span>
              </h2>
            </div>
          </div>
        </div>

        {/* Founder cards */}
        <div className="relative mx-auto max-w-350 px-5 pb-24">
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
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
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                      FILE
                    </span>
                    <span className="font-mono text-sm text-fg">
                      {f.no} / 02
                    </span>
                    <span className="text-fg-faint">·</span>
                    <span
                      className="font-mono text-[11px] uppercase tracking-wider"
                      style={{ color: f.color }}
                    >
                      {f.code}
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
                    <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint mb-1">
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
                  <p className="text-sm leading-relaxed text-fg-dim max-w-[44ch]">
                    {f.longBio}
                  </p>

                  {/* Quote */}
                  <blockquote
                    className="border-l-2 pl-4 font-display text-lg italic leading-snug text-fg-dim"
                    style={{ borderColor: f.color }}
                  >
                    "{f.quote}"
                  </blockquote>

                  {/* Achievements */}
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint mb-3">
                      // achievements
                    </div>
                    <div className="space-y-2">
                      {f.achievements.map((a, i) => (
                        <motion.div
                          key={i}
                          className="flex items-start gap-3 group/item"
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, ease, delay: 0.1 + i * 0.07 }}
                        >
                          <span
                            className="font-mono text-sm shrink-0 mt-0.5"
                            style={{ color: f.color }}
                          >
                            {a.icon}
                          </span>
                          <span className="text-sm text-fg-dim group-hover/item:text-fg transition-colors">
                            {a.text}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
                    {f.stats.map((s) => (
                      <div key={s.k} className="bg-bg p-3">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint truncate">
                          {s.k}
                        </div>
                        <div
                          className="mt-1.5 font-display text-2xl tracking-tightest"
                          style={{ color: f.color }}
                        >
                          {s.v}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Handle footer */}
                  <div className="flex items-center justify-between border-t border-border-soft pt-4 font-mono text-[11px] uppercase tracking-wider text-fg-faint">
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
        <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-20" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-100 w-200 -translate-x-1/2 rounded-full bg-bull/8 blur-[120px]" />

        <div className="relative mx-auto max-w-350 px-5 py-24">
          <motion.div
            className="flex flex-col gap-2 mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              ⟢ Section 02 / Impact
            </span>
            <h2 className="font-display text-[clamp(2.4rem,5.5vw,5rem)] leading-[0.92] tracking-tightest text-fg">
              The bull,
              <br />
              <span className="italic font-light text-bull">by the numbers</span>.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:grid-cols-4">
            {COUNTERS.map((c, i) => (
              <motion.div
                key={c.label}
                className="bg-bg p-8 flex flex-col gap-3"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease, delay: i * 0.1 }}
              >
                <div className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
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
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-20" />

        <div className="relative mx-auto max-w-350 px-5 py-24">
          <motion.div
            className="flex flex-col gap-2 mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
              ⟢ Section 03 / Story
            </span>
            <h2 className="font-display text-[clamp(2.4rem,5.5vw,5rem)] leading-[0.92] tracking-tightest text-fg">
              How we got
              <br />
              <span className="italic font-light text-fg-dim">
                to{" "}
                <span className="text-bull not-italic font-normal">here</span>.
              </span>
            </h2>
          </motion.div>

          {/* Timeline */}
          <div className="relative">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border-soft -translate-x-1/2" />

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
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />

        <div className="relative mx-auto max-w-350 px-5 py-24">
          <motion.div
            className="grid grid-cols-12 items-end gap-5 mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
          >
            <div className="col-span-12 md:col-span-3 flex flex-col gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
                ⟢ Section 04 / Values
              </span>
              <span className="font-mono text-[11px] text-bull">// beliefs.md</span>
            </div>
            <div className="col-span-12 md:col-span-9">
              <h2 className="font-display text-[clamp(2.4rem,5.5vw,5rem)] leading-[0.92] tracking-tightest text-fg">
                What we believe
                <br />
                <span className="italic font-light text-fg-dim">
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
                {/* Corner brackets */}
                <span className="absolute left-2 top-2 size-2 border-l border-t border-fg-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute right-2 top-2 size-2 border-r border-t border-fg-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute left-2 bottom-2 size-2 border-l border-b border-fg-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute right-2 bottom-2 size-2 border-r border-b border-fg-faint opacity-0 group-hover:opacity-100 transition-opacity" />

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
                  <p className="text-sm leading-relaxed text-fg-dim max-w-[38ch]">
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
        <div className="pointer-events-none absolute -left-20 bottom-0 h-100 w-100 rounded-full bg-cyan/8 blur-[120px] drift" style={{ animationDelay: "-5s" }} />

        <div className="relative mx-auto max-w-350 px-5 py-24">
          <motion.div
            className="flex flex-col gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              <span className="text-bull">hiring · remote · equity</span>
            </div>

            <h2 className="font-display text-[clamp(3rem,8vw,7.5rem)] leading-[0.87] tracking-tightest text-fg max-w-3xl">
              Join the
              <br />
              <span className="italic font-light text-bull phosphor">bull</span>
              <span className="text-bull">.</span>
            </h2>

            <p className="max-w-[48ch] text-base leading-relaxed text-fg-dim">
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
              <a
                href="mailto:team@lazybull.trade"
                className="inline-flex items-center gap-3 border border-border px-5 py-3.5 font-mono text-xs uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
              >
                Work with us →
              </a>
            </div>

            {/* Bottom marquee */}
            <div className="mt-8 overflow-hidden border-y border-border-soft py-3 font-mono text-[11px] uppercase tracking-wider">
              <div className="flex marquee gap-10 whitespace-nowrap text-fg-faint">
                {Array.from({ length: 2 }).map((_, k) => (
                  <div key={k} className="flex shrink-0 gap-10">
                    {[
                      "Forbes 30 Under 30",
                      "Y Combinator S24",
                      "50k+ traders",
                      "0.4ms pricing",
                      "2M+ strategies built",
                      "AI teacher on",
                      "kill switch built-in",
                      "$0 to start",
                    ].map((t, i) => (
                      <span key={i} className="flex items-center gap-10">
                        <span className="text-bull">⌖</span>
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
