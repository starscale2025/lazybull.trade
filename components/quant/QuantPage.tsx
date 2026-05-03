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

  const candles = useMemo<Candle[]>(
    () => generateCandles(bars, seed + symbol.charCodeAt(0), spotForSymbol(symbol), drift, vol),
    [bars, seed, symbol, drift, vol]
  );
  const lastSpot = candles[candles.length - 1]?.c ?? 100;

  // Auto-rerun: when dataset changes, invalidate all results
  useEffect(() => {
    setResults({});
  }, [bars, seed, symbol, drift, vol]);

  function getDef(id: string): BotDef | undefined {
    return getBot(id) || customBots.find((b) => b.id === id);
  }

  function runOne(uid: string) {
    const a = active.find((x) => x.uid === uid);
    if (!a) return;
    const def = getDef(a.defId);
    if (!def) return;
    const out = def.run({ candles, symbol }, a.params);
    setResults((r) => ({ ...r, [uid]: out }));
  }

  function runAll() {
    if (active.length === 0) return;
    const next: ResultsMap = {};
    // staggered visual: write each result after a tiny tick so the UI animates
    setResults({});
    let i = 0;
    const tick = () => {
      const a = active[i];
      if (!a) return;
      const def = getDef(a.defId);
      if (def) {
        try {
          next[a.uid] = def.run({ candles, symbol }, a.params);
          setResults({ ...next });
        } catch (err) {
          console.error("bot crashed", a.defId, err);
        }
      }
      i++;
      if (i < active.length) setTimeout(tick, 60);
    };
    tick();
  }

  function addBot(def: BotDef) {
    const uid = `${def.id}-${Math.random().toString(36).slice(2, 8)}`;
    const params: Record<string, number | string | boolean> = {};
    for (const p of def.params) params[p.key] = p.default;
    const newActive = { uid, defId: def.id, params };
    setActive((a) => [...a, newActive]);
    // immediate run for delight
    setTimeout(() => {
      const out = def.run({ candles, symbol }, params);
      setResults((r) => ({ ...r, [uid]: out }));
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

  function updateParams(uid: string, params: Record<string, number | string | boolean>) {
    setActive((a) => a.map((x) => (x.uid === uid ? { ...x, params } : x)));
    // Re-run with new params
    const a = active.find((x) => x.uid === uid);
    if (a) {
      const def = getDef(a.defId);
      if (def) {
        try {
          const out = def.run({ candles, symbol }, params);
          setResults((r) => ({ ...r, [uid]: out }));
        } catch {}
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

  const rows = active.map((a) => ({
    active: a,
    def: getDef(a.defId)!,
    result: results[a.uid] ?? null,
  })).filter((r) => r.def);

  const tape = buildTape(rows);

  return (
    <>
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
      />

      <section className="mx-auto w-full max-w-[1500px] px-5 pt-5">
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: "calc(100vh - 80px)" }}>
          <div ref={libraryRef} className={`col-span-12 lg:col-span-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] transition-shadow duration-700 ${librarySpotlight ? "shadow-[0_0_0_2px_var(--bull),0_0_60px_-10px_var(--bull)]" : ""}`} style={{ height: "calc(100vh - 2rem)" }}>
            <BotLibrary
              bots={BOT_REGISTRY}
              customBots={customBots}
              activeIds={active.map((a) => a.defId)}
              onAdd={addBot}
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
  const sma = getBot("sma-cross");
  const rsi = getBot("rsi-rev");
  const z = getBot("zscore");
  const out: ActiveBot[] = [];
  for (const def of [sma, rsi, z]) {
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
