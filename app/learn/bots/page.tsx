import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Chip, PageHeader, SectionHeading } from "@/components/calm/kit";
import { BOT_REGISTRY } from "@/lib/quant/bots";
import { CATEGORY_META, type BotCategory } from "@/lib/quant/types";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/learn/bots" },
  title: "All bots · lazybull Learn",
  description: "Every teaching bot in the lazybull workbench — the math, where it worked, where it broke, FAQ and a live demo.",
};

const ORDER: BotCategory[] = ["ai", "trend", "stats", "risk", "options", "custom"];

export default function BotsIndex() {
  const grouped = ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
    bots: BOT_REGISTRY.filter((b) => b.category === cat),
  })).filter((g) => g.bots.length > 0);

  return (
    <main className="page-aura flex min-h-screen flex-col bg-bg text-fg">
      <Nav />

      <PageHeader
        eyebrow={
          <Link href="/learn" className="hover:text-fg">
            Learn
          </Link>
        }
        title="Every bot,"
        accent="explained."
        lede={`${BOT_REGISTRY.length} bots, grouped into 5 families. Click any to see the math, when it shines, when it fails, and a live demo.`}
      />

      {grouped.map((g) => (
        <section key={g.cat} id={g.cat} className="scroll-mt-20">
          <div className="shell pb-[clamp(3rem,7vw,4.5rem)]">
            <div className="flex items-end justify-between gap-4">
              <SectionHeading eyebrow={g.meta.hint.charAt(0).toUpperCase() + g.meta.hint.slice(1)} title={g.meta.label} />
              <span className="shrink-0 text-[0.8125rem] text-fg-faint">{g.bots.length} bots</span>
            </div>

            {/* One panel per family, the bots as plain cells in it: up to a
                dozen in a family, and a panel each is an aura each. */}
            <div className="calm-panel mt-6 grid grid-cols-1 gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
              <i aria-hidden className="lit-aura" />
              {g.bots.map((b) => (
                <Link
                  key={b.id}
                  href={`/learn/bots/${b.id}`}
                  className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-fg/[0.05]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-fg/[0.07] font-display text-lg text-fg-dim">
                    {b.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg transition-colors group-hover:text-brand-ink">
                        {b.name}
                      </span>
                      {/* Section header already says AI Quants — the per-card badge would repeat 12× */}
                      {b.endpoint && g.cat !== "ai" && <Chip>AI</Chip>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-fg-dim">{b.tagline}</p>
                    <div className="mt-1.5 t-label text-fg-faint">{b.id}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <Footer marketing />
    </main>
  );
}
