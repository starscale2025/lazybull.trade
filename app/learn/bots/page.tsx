import Link from "next/link";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { BOT_REGISTRY } from "@/lib/quant/bots";
import { CATEGORY_META, type BotCategory } from "@/lib/quant/types";

export const metadata = {
  title: "All bots · Lazybull Learn",
  description: "Encyclopedia of every bot in the Lazybull workbench — math, specialty, FAQ, live demo.",
};

const ORDER: BotCategory[] = ["ai", "trend", "stats", "risk", "options", "custom"];

export default function BotsIndex() {
  const grouped = ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
    bots: BOT_REGISTRY.filter((b) => b.category === cat),
  })).filter((g) => g.bots.length > 0);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* Header */}
      <section className="border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1200px] px-5 py-12">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            <Link href="/learn" className="hover:text-fg">Learn</Link>
            <span>/</span>
            <span className="text-fg">Bots</span>
          </div>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,5vw,4rem)] tracking-tightest leading-[0.95]">
            Every bot,
            <span className="italic font-light text-bull"> explained.</span>
          </h1>
          <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-fg-dim">
            {BOT_REGISTRY.length} bots, grouped into 5 families. Click any to see the
            math, when it shines, when it fails, and a live demo.
          </p>
        </div>
      </section>

      {grouped.map((g) => (
        <section
          key={g.cat}
          id={g.cat}
          className="border-b border-border scroll-mt-20"
        >
          <div className="mx-auto max-w-[1200px] px-5 py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div
                  className="font-mono text-[11px] uppercase tracking-[0.25em]"
                  style={{ color: g.meta.color }}
                >
                  ⟢ {g.meta.label}
                </div>
                <h2 className="mt-2 font-display text-[clamp(1.8rem,3vw,2.6rem)] tracking-tightest leading-[1.05]">
                  {g.meta.label}
                </h2>
                <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-fg-dim">
                  {g.meta.hint}
                </p>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
                {g.bots.length} bots
              </span>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.bots.map((b) => (
                <Link
                  key={b.id}
                  href={`/learn/bots/${b.id}`}
                  className="group flex flex-col gap-3 border border-border bg-surface p-4 transition-colors hover:border-bull/60 hover:bg-bull/[0.03]"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="grid size-9 place-items-center border border-border bg-bg font-display text-xl"
                      style={{ color: g.meta.color }}
                    >
                      {b.glyph}
                    </span>
                    {b.endpoint && (
                      <span className="border border-bear/40 bg-bear/10 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-bear">
                        AI
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-display text-[18px] tracking-tightest text-fg group-hover:text-bull">
                      {b.name}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-fg-dim">
                      {b.tagline}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint group-hover:text-bull">
                    <span>{b.id}</span>
                    <span>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <Footer />
    </main>
  );
}
