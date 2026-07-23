"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QuickBet } from "@/components/bet/QuickBet";
import { generateCandles, type Candle } from "@/lib/candles";
import { applyTick, reconcileBars, type FreshestRef } from "@/lib/live-bars";
import { SYMBOL_PRESETS, presetSignature } from "@/lib/quant/presets";
import { track } from "@/lib/track";
import { BOT_REGISTRY, getBot } from "@/lib/quant/bots";
import type { ActiveBot, BotDef, BotResult } from "@/lib/quant/types";
import { QuantHero } from "./QuantHero";
import { SetupsBar, type QuantSetupState } from "./SetupsBar";
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
  // LIVE runs the bots on the real (delayed ~15s) Yahoo tape and keeps it
  // ticking; SEED runs them on the deterministic synthetic walk with the
  // seed/drift/vol knobs fully in play. Persisted so a returning tinkerer
  // lands back in the sandbox they left.
  const [mode, setModeState] = useState<"live" | "seed">(() => {
    if (typeof window === "undefined") return "live";
    try {
      return localStorage.getItem("lb-quant-mode") === "seed" ? "seed" : "live";
    } catch {
      return "live";
    }
  });
  const setMode = (m: "live" | "seed") => {
    setModeState(m);
    track("quant_mode", { mode: m });
    try {
      localStorage.setItem("lb-quant-mode", m);
    } catch {}
  };
  const [beginner, setBeginner] = useState(true);
  // Boot with the symbol's recommended stack (why-labels in the strip below
  // the hero) rather than a generic set.
  const [active, setActive] = useState<ActiveBot[]>(() => presetActive("AMZN") ?? seedActive());
  const [results, setResults] = useState<ResultsMap>({});
  const [customBots, setCustomBots] = useState<BotDef[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [librarySpotlight, setLibrarySpotlight] = useState(false);
  const libraryRef = useRef<HTMLDivElement>(null);
  const [showLearnBanner, setShowLearnBanner] = useState(false);

  // Live Yahoo OHLCV for the chosen symbol. Falls back to a deterministic
  // synthetic walk only if the fetch fails (custom symbol, network down, etc.).
  // What the quote fetch actually depends on. Live bars are a function of the
  // symbol and the window length only — never of seed/drift/vol.
  const liveKey = `${symbol}|${bars}`;
  // Tagged with the key it was fetched for, so a late response for a previous
  // symbol can never be read as the current one.
  const [live, setLive] = useState<{ key: string; candles: Candle[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "synthetic">("loading");
  // When the next live-feed retry fires — powers the OFFLINE "live in Ns" countdown.
  const [retryAt, setRetryAt] = useState<number | null>(null);

  // The freshest known trade, ordered by upstream regularMarketTime — the bars
  // proxy and the spot poll cache separately, so either can be the staler
  // snapshot. Same guard /pro uses (lib/live-bars).
  const freshestRef = useRef<FreshestRef["current"]>(null);

  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    const key = `${symbol}|${bars}`;
    setStatus("loading");
    const load = async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.bars) && j.bars.length > 30) {
          const tail: Candle[] = j.bars.slice(-bars).map((b: { o: number; h: number; l: number; c: number }) => ({
            o: b.o, h: b.h, l: b.l, c: b.c,
          }));
          // A 30s-cached refetch must never walk the tape behind a newer tick.
          setLive({ key, candles: reconcileBars(tail, j.meta, symbol, freshestRef) });
          setStatus("live");
          setRetryAt(null);
          return;
        }
        setStatus("synthetic");
        setRetryAt(Date.now() + 30_000); // the poll retries every 30s
      } catch {
        if (!cancelled) {
          setStatus("synthetic");
          setRetryAt(Date.now() + 30_000);
        }
      }
    };
    void load();
    // Live means live: the tape refetches while you sit on the page. /quant
    // used to fetch once and quietly go stale for the whole session.
    const id = setInterval(() => void load(), 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol, bars, mode]);

  // 15s spot tick folded into the developing candle, so lastSpot and the
  // QuickBet mark move between refetches. Bots do NOT silently re-run on
  // ticks — results stay put until the dataset identity changes (below).
  useEffect(() => {
    if (mode !== "live") return;
    let alive = true;
    const key = `${symbol}|${bars}`;
    const tick = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${encodeURIComponent(symbol)}`);
        const j = await r.json();
        if (!alive || !j?.ok) return;
        const q = (j.quotes as { sym: string; last?: number; marketTime?: number | null }[] | undefined)?.find(
          (x) => x.sym === symbol
        );
        if (!q || q.last == null) return;
        setLive((cur) => {
          if (!cur || cur.key !== key) return cur;
          const next = applyTick(cur.candles, { sym: symbol, price: q.last as number, t: q.marketTime ?? 0 }, symbol, freshestRef);
          return next ? { key: cur.key, candles: next } : cur;
        });
      } catch {
        /* keep the last tape on a failed tick */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 15_000);
    return () => { alive = false; clearInterval(id); };
  }, [symbol, bars, mode]);

  // Stale-guard: only accept live bars that were fetched for the CURRENT key.
  const liveCandles = mode === "live" && live && live.key === liveKey ? live.candles : null;

  const syntheticCandles = useMemo<Candle[]>(
    () => generateCandles(bars, seed + symbol.charCodeAt(0), spotForSymbol(symbol), drift, vol),
    [bars, seed, symbol, drift, vol]
  );
  // SEED mode is a deliberate choice of the synthetic tape; in LIVE mode the
  // synthetic walk remains only as a visible fallback when the feed is down.
  const candles = mode === "seed" ? syntheticCandles : (liveCandles ?? syntheticCandles);
  const lastSpot = candles[candles.length - 1]?.c ?? 100;

  // The badge must describe the bars the bots are ACTUALLY computing on.
  // "fallback" is live mode without live data — same walk as seed, but shown
  // as a degraded state with a banner rather than a chosen sandbox.
  const dataSource: "live" | "seed" | "fallback" =
    mode === "seed" ? "seed" : liveCandles ? "live" : "fallback";
  // seed/drift/vol shape the tape only in SEED mode. In the live-mode fallback
  // they stay frozen — a degraded feed shouldn't quietly become a sandbox.
  const syntheticKnobsActive = mode === "seed";

  // Invalidate results when the dataset the bots run on actually changes.
  //
  // This used to depend on the `liveCandles` ARRAY, which the fetch reassigned
  // on every resolve — so a quote landing after a completed RUN ALL silently
  // wiped it and the button looked broken. Keying on a string identity means a
  // response that doesn't change the data doesn't destroy the run.
  //
  // In live mode the identity includes the bar COUNT: 15s ticks mutate the
  // developing candle without changing it (results survive), while a refetch
  // that appends a new session busts it. The knobs only participate in seed
  // mode, where they can actually affect the bars.
  const datasetId =
    mode === "seed"
      ? `syn:${symbol}|${bars}|${seed}|${drift}|${vol}`
      : liveCandles
        ? `live:${liveKey}:${liveCandles.length}`
        : `fallback:${liveKey}`;
  // When the last full run happened — shown beside the verdict so a result
  // computed minutes ago on a moving tape is self-describing, since bots
  // deliberately never re-run on their own.
  const [ranAt, setRanAt] = useState<number | null>(null);

  useEffect(() => {
    setResults({});
    setRanAt(null);
  }, [datasetId]);

  /**
   * First-mount auto-run — fires the seeded bots once on initial page
   * load (after the first set of candles is available) so a fresh visitor
   * sees the run-stream + decimation animations cascade across the
   * workspace instead of landing on a row of "press ▶ run" placeholders.
   *
   * Guarded by a ref so it only ever runs once per page life. Subsequent
   * dataset changes (symbol / bars / seed) still wipe results via the
   * effect above and require an explicit ▶ Run All — that's intentional,
   * we don't want bots silently rerunning every slider tick.
   */
  // Every setTimeout below used to outlive unmount: the runAll stagger chain
  // kept re-arming itself and calling setResults on a dead component, and
  // addBot/flashLibrary's one-shots did the same. Track them all and clear on
  // unmount.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
    return t;
  };
  useEffect(
    () => () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current.clear();
    },
    []
  );

  const didAutoRunRef = useRef(false);
  useEffect(() => {
    if (didAutoRunRef.current) return;
    if (active.length === 0) return;
    if (mode === "live" && status === "loading") return; // else we'd run on the fallback walk mid-fetch
    if (candles.length < 20) return; // wait for candles to be ready
    didAutoRunRef.current = true;
    // Defer to the next tick so the page paints once before the first
    // cell starts streaming — gives the hero a beat to settle.
    const timer = setTimeout(() => runAll(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length, active.length, status]);

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
    track("quant_run_all", { symbol, mode, bots: active.length });
    setRanAt(Date.now());
    const next: ResultsMap = {};
    setResults({});
    let i = 0;
    // Stagger ~220ms between bots so the run-stream animations in each
    // BotCell visibly cascade down the workspace instead of all firing
    // at once. Each cell's stream runs ~950ms, so adjacent cells overlap
    // but the start times are clearly distinct.
    const RUN_STAGGER_MS = 220;
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
      if (i < active.length) later(tick, RUN_STAGGER_MS);
    };
    void tick();
  }

  function addBot(def: BotDef) {
    const uid = `${def.id}-${Math.random().toString(36).slice(2, 8)}`;
    const params: Record<string, number | string | boolean> = {};
    for (const p of def.params) params[p.key] = p.default;
    const newActive = { uid, defId: def.id, params };
    setActive((a) => [...a, newActive]);
    later(async () => {
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

  // ── recommended stack per symbol. Auto-swaps ONLY while the workspace is
  // exactly the last-applied preset — the moment the user customizes, their
  // stack is theirs and symbol changes leave it alone.
  const lastPresetSigRef = useRef<string | null>(
    SYMBOL_PRESETS["AMZN"] ? presetSignature(SYMBOL_PRESETS["AMZN"].bots) : null
  );

  function applyPreset(sym: string) {
    const rebuilt = presetActive(sym);
    if (!rebuilt) return;
    setActive(rebuilt);
    setResults({});
    lastPresetSigRef.current = presetSignature(rebuilt);
    track("preset_applied", { symbol: sym, bots: rebuilt.length });
  }

  const symbolPreset = SYMBOL_PRESETS[symbol];
  useEffect(() => {
    if (!SYMBOL_PRESETS[symbol]) return;
    const sig = presetSignature(active);
    if (lastPresetSigRef.current && sig === lastPresetSigRef.current) {
      const target = presetSignature(SYMBOL_PRESETS[symbol].bots);
      if (sig !== target) applyPreset(symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── saved setups (profile-backed): the whole experiment as config.
  const setupState = (): QuantSetupState => ({
    symbol,
    bars,
    mode,
    seed,
    drift,
    vol,
    // Registry bots only — custom imports are code, not config.
    active: active.filter((a) => getBot(a.defId)).map(({ defId, params }) => ({ defId, params })),
  });

  function applySetup(s: QuantSetupState) {
    if (!s || typeof s !== "object") return;
    if (typeof s.symbol === "string" && s.symbol) setSymbol(s.symbol.toUpperCase().slice(0, 12));
    if (Number.isFinite(s.bars)) setBars(Math.min(500, Math.max(60, Math.round(s.bars))));
    if (s.mode === "live" || s.mode === "seed") setMode(s.mode);
    if (Number.isFinite(s.seed)) setSeed(Math.min(500, Math.max(1, Math.round(s.seed))));
    if (Number.isFinite(s.drift)) setDrift(Math.min(0.5, Math.max(-0.5, s.drift)));
    if (Number.isFinite(s.vol)) setVol(Math.min(5, Math.max(0.2, s.vol)));
    if (Array.isArray(s.active)) {
      const rebuilt: ActiveBot[] = [];
      for (const a of s.active.slice(0, 24)) {
        if (!a || typeof a.defId !== "string" || !getBot(a.defId)) continue;
        rebuilt.push({
          uid: `${a.defId}-${Math.random().toString(36).slice(2, 8)}`,
          defId: a.defId,
          params: (a.params && typeof a.params === "object" ? a.params : {}) as ActiveBot["params"],
        });
      }
      setActive(rebuilt);
      setResults({});
    }
  }

  function flashLibrary() {
    setLibrarySpotlight(true);
    libraryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    later(() => setLibrarySpotlight(false), 1200);
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
      {mode === "live" && status === "synthetic" && (
        <div className="border-b border-amber/30 bg-amber/5 px-5 py-2">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-amber">⚠ live feed unreachable</span>
            <span className="normal-case tracking-normal text-fg-dim">
              Showing a deterministic fallback tape — verdicts below are NOT about the real {symbol}.
            </span>
            <button
              onClick={() => setMode("seed")}
              className="ml-auto border border-amber/50 bg-amber/10 px-3 py-1 text-amber hover:bg-amber/20"
            >
              use seed mode →
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
        mode={mode}
        setMode={setMode}
        dataSource={dataSource}
        retryAt={retryAt}
        syntheticKnobsActive={syntheticKnobsActive}
      />

      {/* Recommended stack — which models suit THIS tape, and why. */}
      {symbolPreset && (
        <section className="mx-auto w-full max-w-[1500px] px-5 pt-4">
          <div className="border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bull">
                ★ recommended for {symbol}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                {symbolPreset.character}
              </span>
              {presetSignature(active) !== presetSignature(symbolPreset.bots) && (
                <button
                  onClick={() => applyPreset(symbol)}
                  className="ml-auto border border-bull/50 bg-bull/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-bull transition-colors hover:bg-bull hover:text-bg"
                >
                  apply this stack
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-px bg-border-soft sm:grid-cols-2 lg:grid-cols-4">
              {symbolPreset.bots.map((b) => {
                const def = getBot(b.defId);
                if (!def) return null;
                const isActive = active.some((a) => a.defId === b.defId);
                return (
                  <button
                    key={b.defId}
                    onClick={() => {
                      if (!isActive) addBot(def);
                    }}
                    title={isActive ? "already in the workspace" : "add to workspace"}
                    className="group bg-bg p-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg">
                      <span className={`size-1.5 shrink-0 rounded-full ${isActive ? "bg-bull" : "bg-border"}`} />
                      <span className="truncate">{def.name}</span>
                      {!isActive && <span className="ml-auto shrink-0 text-fg-faint group-hover:text-bull">+ add</span>}
                    </div>
                    <div className="mt-1 font-mono text-[10px] normal-case leading-relaxed text-fg-dim">{b.why}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-end px-5 pt-3">
        <SetupsBar getState={setupState} onApply={applySetup} />
      </div>

      <section className="mx-auto w-full max-w-[1500px] px-5 pt-2">
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
              symbol={symbol}
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
            <OutputPanel runs={rows} symbol={symbol} spot={lastSpot} beginner={beginner} ranAt={ranAt} dataSource={dataSource} />
          </div>
        </div>
      </section>

      {/* Bottom tape */}
      <section className="mt-8 overflow-hidden border-y border-border bg-bg-soft py-3 font-mono text-[11px] uppercase tracking-wider">
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

      {/* One-tap paper bet, fed the same candles the bots just ran on. Locked
          in seed mode: synthetic prices must never book into the real shared
          paper account. */}
      <QuickBet
        symbol={symbol}
        spot={lastSpot}
        candles={candles}
        lockReason={mode === "seed" ? "seed tape — switch to live to bet at real prices" : null}
        onUnlock={() => setMode("live")}
      />
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

/** Build the active stack for a symbol's recommended preset, default params. */
function presetActive(sym: string): ActiveBot[] | null {
  const p = SYMBOL_PRESETS[sym];
  if (!p) return null;
  const out: ActiveBot[] = [];
  for (const b of p.bots) {
    const def = getBot(b.defId);
    if (!def) continue;
    const params: Record<string, number | string | boolean> = {};
    for (const pr of def.params) params[pr.key] = pr.default;
    out.push({ uid: `${b.defId}-${Math.random().toString(36).slice(2, 8)}`, defId: b.defId, params });
  }
  return out.length ? out : null;
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
