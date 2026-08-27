"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";

const ease = [0.22, 1, 0.36, 1] as const;

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
    glowBg: "rgba(0,229,255,0.08)",
    bio: "Shaurya is where LazyBull started. A CS student teaching himself derivatives on the side, he kept watching friends lose money on options trades they didn't fully understand — and decided the interfaces, not the people, were broken.",
    longBio: "The whole thing began with Shaurya sketching a drag-to-build options chain on the back of a notebook. He'd been teaching himself derivatives pricing for months, and the gap between what a retail platform showed you and what was actually happening under the hood drove him crazy. The first crude prototype was his — everything else grew from that seed.",
    achievements: [
      { icon: "✦", text: "Teaching himself derivatives & options pricing" },
      { icon: "◈", text: "Originated the drag-to-build chain concept" },
      { icon: "▲", text: "Hand-rolled the first Black-Scholes prototype in C++" },
      { icon: "◎", text: "Owns the on-device ML + quant models" },
      { icon: "⬡", text: "Maintains the pricing engine and Greeks math" },
    ],
    stats: [
      { k: "Idea started", v: "2026" },
      { k: "Boards filled", v: "27" },
      { k: "Cold brews / wk", v: "12" },
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
    glowBg: "rgba(0,255,135,0.08)",
    bio: "Joshmann took Shaurya's idea and made it shippable. He refined the rough prototype into the visual language, motion, and product flow LazyBull is built around today.",
    longBio: "When Shaurya showed him the first scrappy chain mockup, Joshmann saw the whole product hiding inside it. He spent the next few months reshaping the UX — the heatmap grid, the drag interactions, the AI teacher panel — and turned a clever prototype into something a stranger could open and instantly understand. Product, design, and front-end are his domain.",
    achievements: [
      { icon: "✦", text: "Turned the prototype into a product you can just open" },
      { icon: "◈", text: "Refined Shaurya's prototype into the product it is today" },
      { icon: "▲", text: "Designed the visual chain, motion system, and AI teacher UI" },
      { icon: "◎", text: "Owns the front-end, design system, and brand" },
      { icon: "⬡", text: "Built the heatmap grid and drag-to-build interactions" },
    ],
    stats: [
      { k: "Pixel iterations", v: "2.4k" },
      { k: "Figma frames", v: "847" },
      { k: "Sleep / night", v: "~5h" },
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
    bio: "Pratham joined later — and turned a strong idea into a real company. He took the prototype, the vision, and the loose roadmap, and pulled them into a launch plan, an early-access program, and the business behind LazyBull.",
    longBio: "By the time Pratham came in, the product worked but the company didn't. He brought structure: a roadmap, a feedback loop with early users, a real onboarding flow, and the safety-rail philosophy that runs through every page. If Shaurya is the why and Joshmann is the how, Pratham is the when, where, and who-for.",
    achievements: [
      { icon: "✦", text: "Owns ops, strategy, and growth" },
      { icon: "◈", text: "Solidified the vision into a roadmap and launch plan" },
      { icon: "▲", text: "Designed the safety-rail and paper-trade onboarding" },
      { icon: "◎", text: "Runs early-user research and the feedback loop" },
      { icon: "⬡", text: "Talks to new options traders every week" },
    ],
    stats: [
      { k: "Specs written", v: "39" },
      { k: "User chats", v: "ongoing" },
      { k: "Sticky notes", v: "∞" },
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
    desc: "Joshmann sees the prototype and immediately reshapes it — the heatmap, the motion, the AI teacher panel. The rough idea starts to look like a product.",
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
    desc: "Pratham turns scattered docs into a real roadmap. Safety rails, onboarding, and early-user research all get owners.",
    color: "var(--plasma)",
    side: "right",
  },
  {
    date: "2026",
    label: "On-device AI",
    desc: "The AI teacher and on-device quant models ship — Greeks, IV, and predictions that explain themselves and run right in your browser.",
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
            <span className="hidden sm:inline">lazybull.trade</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            <span>Founded 2026</span>
          </div>
        </div>

        <div className="relative shell section-y">
          <motion.div
            className="max-w-4xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
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
              LazyBull was built by three founders who believed options trading
              was being made{" "}
              <span className="text-fg">artificially complex</span> to keep
              retail traders on the wrong side of the trade. We're changing
              that.
            </p>
          </motion.div>
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
              <div className="flex items-center gap-2 font-mono text-[10px] text-fg-faint">
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
                <div className="mt-6 font-mono text-[11px] text-fg-faint">
                  — Shaurya Negi, Co-Founder · Originator
                </div>
              </div>
              <div className="p-8">
                <div className="t-chrome text-fg-faint mb-4">
                  // the fix
                </div>
                <div className="space-y-4 font-mono text-[12px] leading-relaxed text-fg-dim">
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
              <span className="font-mono text-[11px] text-bull">// team.md</span>
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
              <span className="font-mono text-[11px] text-bull">// beliefs.md</span>
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
              <a
                href="mailto:team@lazybull.trade"
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
