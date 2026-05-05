"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateCandles, type Candle } from "@/lib/candles";
import { BOT_REGISTRY, getBot } from "@/lib/quant/bots";
import type { ActiveBot, BotDef, BotResult } from "@/lib/quant/types";
import { QuantHero } from "./QuantHero";
import { BotLibrary } from "./BotLibrary";
import { Workspace } from "./Workspace";
import { OutputPanel } from "./OutputPanel";
import { ImportBotModal } from "./ImportBotModal";

type ResultsMap = Record<string, BotResult>;

export function QuantPage() {
  const [symbol, setSymbol] = useState("AMZN");
  const [bars, setBars] = useState(180);
  const [seed, setSeed] = useState(11);
  const [drift, setDrift] = useState(0.18);
  const [vol, setVol] = useState(1.6);
  const [beginner, setBeginner] = useState(true);
  const [active, setActive] = useState<ActiveBot[]>(() => seedActive());
  const [results, setResults] = useState<ResultsMap>({});
  const [customBots, setCustomBots] = useState<BotDef[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [librarySpotlight, setLibrarySpotlight] = useState(false);
  const libraryRef = useRef<HTMLDivElement>(null);
  const [showLearnBanner, setShowLearnBanner] = useState(false);

  // Live Yahoo OHLCV for the chosen symbol. Falls back to a deterministic
  // synthetic walk only if the fetch fails (custom symbol, network down, etc.).
  const [liveCandles, setLiveCandles] = useState<Candle[] | null>(null);
  const [dataSource, setDataSource] = useState<"live" | "synthetic">("synthetic");

  useEffect(() => {
    let cancelled = false;
    setLiveCandles(null);
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.bars) && j.bars.length > 30) {
          const tail = j.bars.slice(-bars).map((b: { o: number; h: number; l: number; c: number }) => ({
            o: b.o, h: b.h, l: b.l, c: b.c,
          }));
          setLiveCandles(tail);
          setDataSource("live");
          return;
        }
        setDataSource("synthetic");
      } catch {
        if (!cancelled) setDataSource("synthetic");
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, bars]);

  const syntheticCandles = useMemo<Candle[]>(
    () => generateCandles(bars, seed + symbol.charCodeAt(0), spotForSymbol(symbol), drift, vol),
    [bars, seed, symbol, drift, vol]
  );
  const candles = liveCandles ?? syntheticCandles;
  const lastSpot = candles[candles.length - 1]?.c ?? 100;

  // Auto-rerun: when dataset changes, invalidate all results
  useEffect(() => {
    setResults({});
  }, [bars, seed, symbol, drift, vol, liveCandles]);

  function getDef(id: string): BotDef | undefined {
    return getBot(id) || customBots.find((b) => b.id === id);
  }

  async function runOne(uid: string) {
    const a = active.find((x) => x.uid === uid);
    if (!a) return;
    const def = getDef(a.defId);
    if (!def) return;
    try {
      const out = await Promise.resolve(def.run({ candles, symbol }, a.params));
      setResults((r) => ({ ...r, [uid]: out }));
    } catch (err) {
      console.error("bot crashed", a.defId, err);
    }
  }

  function runAll() {
    if (active.length === 0) return;
    const next: ResultsMap = {};
    setResults({});
    let i = 0;
    const tick = async () => {
      const a = active[i];
      if (!a) return;
      const def = getDef(a.defId);
      if (def) {
        try {
          next[a.uid] = await Promise.resolve(def.run({ candles, symbol }, a.params));
          setResults({ ...next });
        } catch (err) {
          console.error("bot crashed", a.defId, err);
        }
      }
      i++;
      if (i < active.length) setTimeout(tick, 60);
    };
    void tick();
  }

  function addBot(def: BotDef) {
    const uid = `${def.id}-${Math.random().toString(36).slice(2, 8)}`;
    const params: Record<string, number | string | boolean> = {};
    for (const p of def.params) params[p.key] = p.default;
    const newActive = { uid, defId: def.id, params };
    setActive((a) => [...a, newActive]);
    setTimeout(async () => {
      try {
        const out = await Promise.resolve(def.run({ candles, symbol }, params));
        setResults((r) => ({ ...r, [uid]: out }));
      } catch (err) {
        console.error("bot crashed", def.id, err);
      }
    }, 50);
  }

  function removeBot(uid: string) {
    setActive((a) => a.filter((x) => x.uid !== uid));
    setResults((r) => {
      const next = { ...r };
      delete next[uid];
      return next;
    });
  }

  function removeBotsByDefId(defId: string) {
    const doomed = active.filter((x) => x.defId === defId).map((x) => x.uid);
    if (doomed.length === 0) return;
    setActive((a) => a.filter((x) => x.defId !== defId));
    setResults((r) => {
      const next = { ...r };
      for (const uid of doomed) delete next[uid];
      return next;
    });
  }

  function updateParams(uid: string, params: Record<string, number | string | boolean>) {
    setActive((a) => a.map((x) => (x.uid === uid ? { ...x, params } : x)));
    const a = active.find((x) => x.uid === uid);
    if (a) {
      const def = getDef(a.defId);
      if (def) {
        void (async () => {
          try {
            const out = await Promise.resolve(def.run({ candles, symbol }, params));
            setResults((r) => ({ ...r, [uid]: out }));
          } catch {}
        })();
      }
    }
  }

  function toggleCollapse(uid: string) {
    setActive((a) => a.map((x) => (x.uid === uid ? { ...x, collapsed: !x.collapsed } : x)));
  }

  function moveBot(uid: string, dir: -1 | 1) {
    setActive((a) => {
      const i = a.findIndex((x) => x.uid === uid);
      if (i < 0) return a;
      const j = i + dir;
      if (j < 0 || j >= a.length) return a;
      const copy = [...a];
      const [el] = copy.splice(i, 1);
      copy.splice(j, 0, el);
      return copy;
    });
  }

  function clearAll() {
    setActive([]);
    setResults({});
  }

  function importBot(def: BotDef) {
    setCustomBots((b) => [def, ...b]);
    addBot(def);
  }

  function flashLibrary() {
    setLibrarySpotlight(true);
    libraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setLibrarySpotlight(false), 1200);
  }

  // ── Learn-page soft pointer (first-time visitor)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = localStorage.getItem("lb_quant_seen_v1");
      if (!seen) setShowLearnBanner(true);
    } catch {
      /* localStorage blocked */
    }
  }, []);
  function dismissLearnBanner() {
    setShowLearnBanner(false);
    try { localStorage.setItem("lb_quant_seen_v1", "1"); } catch {}
  }

  // ── Deep-link: /quant?add=<botId> auto-adds the bot once on mount.
  const didConsumeAddRef = useRef(false);
  useEffect(() => {
    if (didConsumeAddRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const addId = params.get("add");
    if (!addId) return;
    const def = getDef(addId);
    if (!def) return;
    didConsumeAddRef.current = true;
    // Avoid duplicating if already present.
    if (!active.some((a) => a.defId === addId)) {
      addBot(def);
    }
    // Strip the param from the URL so a refresh doesn't re-add.
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = active.map((a) => ({
    active: a,
    def: getDef(a.defId)!,
    result: results[a.uid] ?? null,
  })).filter((r) => r.def);

  const tape = buildTape(rows);

  return (
    <>
      {showLearnBanner && (
        <div className="border-b border-bull/30 bg-bull/5 px-5 py-2.5">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wider">
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            <span className="text-bull">First time here?</span>
            <span className="text-fg-dim normal-case tracking-normal">
              Stack bots like Lego blocks. The Learn page walks through it in 3 minutes.
            </span>
            <a
              href="/learn"
              className="ml-auto inline-flex items-center gap-2 border border-bull bg-bull/10 px-3 py-1 text-bull hover:bg-bull/20"
            >
              See how it works →
            </a>
            <button
              onClick={dismissLearnBanner}
              className="text-fg-faint hover:text-fg"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <QuantHero
        symbol={symbol}
        setSymbol={setSymbol}
        bars={bars}
        setBars={setBars}
        seed={seed}
        setSeed={setSeed}
        drift={drift}
        setDrift={setDrift}
        vol={vol}
        setVol={setVol}
        beginner={beginner}
        setBeginner={setBeginner}
        onRunAll={runAll}
        onClearAll={clearAll}
        activeCount={active.length}
        totalBots={BOT_REGISTRY.length + customBots.length}
        spot={lastSpot}
        dataSource={dataSource}
      />

      <section className="mx-auto w-full max-w-[1500px] px-5 pt-5">
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: "calc(100vh - 80px)" }}>
          <div ref={libraryRef} className={`col-span-12 lg:col-span-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] transition-shadow duration-700 ${librarySpotlight ? "shadow-[0_0_0_2px_var(--bull),0_0_60px_-10px_var(--bull)]" : ""}`} style={{ height: "calc(100vh - 2rem)" }}>
            <BotLibrary
              bots={BOT_REGISTRY}
              customBots={customBots}
              activeIds={active.map((a) => a.defId)}
              onAdd={addBot}
              onRemove={removeBotsByDefId}
              onImport={() => setImportOpen(true)}
            />
          </div>

          <div className="col-span-12 lg:col-span-6" style={{ minHeight: "70vh" }}>
            <Workspace
              rows={rows}
              candles={candles}
              beginner={beginner}
              onUpdateParams={updateParams}
              onRemove={removeBot}
              onToggleCollapse={toggleCollapse}
              onRerun={runOne}
              onMove={moveBot}
              onAddPlaceholderClick={flashLibrary}
            />
          </div>

          <div className="col-span-12 lg:col-span-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)]" style={{ height: "calc(100vh - 2rem)" }}>
            <OutputPanel runs={rows} symbol={symbol} spot={lastSpot} beginner={beginner} />
          </div>
        </div>
      </section>

      {/* Bottom tape */}
      <section className="mt-8 border-y border-border bg-bg-soft py-3 font-mono text-[11px] uppercase tracking-wider">
        <div className="flex marquee-slow gap-10 whitespace-nowrap text-fg-faint">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex shrink-0 gap-10">
              {tape.map((t, i) => (
                <span key={i} className="flex items-center gap-3">
                  <span className={t.tone === "buy" ? "text-bull" : t.tone === "sell" ? "text-bear" : t.tone === "warn" ? "text-amber" : "text-cyan"}>
                    ⌖
                  </span>
                  <span>{t.text}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <ImportBotModal open={importOpen} onClose={() => setImportOpen(false)} onImport={importBot} />
    </>
  );
}

function spotForSymbol(s: string) {
  const map: Record<string, number> = {
    AMZN: 226, AAPL: 232, NVDA: 178, TSLA: 312, SPY: 612,
    QQQ: 558, BTC: 95400, META: 745, MSFT: 458, GOOG: 195,
  };
  return map[s] ?? 100;
}

function seedActive(): ActiveBot[] {
  // Seed the workspace with the AI consensus + a couple of classics so the user
  // sees the AI bots immediately, side-by-side with the math they already know.
  const consensus = getBot("ai-consensus");
  const direction = getBot("ai-direction");
  const sma = getBot("sma-cross");
  const z = getBot("zscore");
  const out: ActiveBot[] = [];
  for (const def of [consensus, direction, sma, z]) {
    if (!def) continue;
    const params: Record<string, number | string | boolean> = {};
    for (const p of def.params) params[p.key] = p.default;
    out.push({ uid: `${def.id}-${Math.random().toString(36).slice(2, 7)}`, defId: def.id, params });
  }
  return out;
}

function buildTape(rows: { def: BotDef; result: BotResult | null }[]): { text: string; tone: string }[] {
  const items: { text: string; tone: string }[] = [];
  for (const r of rows) {
    if (!r.result) continue;
    items.push({ text: `${r.def.name.toUpperCase()} → ${r.result.verdict.side.toUpperCase()}`, tone: r.result.verdict.side });
  }
  if (items.length === 0) {
    return [
      { text: "STACK BOTS LIKE JUPYTER CELLS", tone: "info" },
      { text: "BRING YOUR OWN BOT", tone: "info" },
      { text: "PLAIN-ENGLISH MODE FOR BEGINNERS", tone: "info" },
      { text: "DETERMINISTIC · CLIENT-SIDE", tone: "info" },
      { text: "15+ STRATEGIES TO CHOOSE FROM", tone: "info" },
    ];
  }
  return items;
}
