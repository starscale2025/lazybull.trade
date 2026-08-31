"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveBot, BotDef, BotResult, ParamSpec, Tone } from "@/lib/quant/types";
import { SOURCE_META, sourceForCategory } from "@/lib/quant/provenance";
import { closes } from "@/lib/quant/series";
import type { Candle } from "@/lib/candles";
import { PriceWithOverlay, PaneLine, EquitySpark } from "./MiniViz";
import { RunStream } from "./RunStream";
import { DecimatedNumber } from "./DecimatedNumber";

/**
 * Run animation timing.
 *
 * STREAM_MS — duration of the typewriter-style log block. Long enough for
 *   the user to read 2-3 lines and feel that something computed; short
 *   enough not to feel padded. Calibrated against `def.run()` returning
 *   synchronously: the animation effectively *is* the perceived runtime.
 *
 * DECIMATE_MS — duration of the scramble-to-resolve animation on the
 *   metric values. Longer than the line-print so the eye lingers on the
 *   numbers settling, which is the moment the user came here for.
 */
const STREAM_MS = 950;
const DECIMATE_MS = 700;

type Phase = "idle" | "streaming" | "decimating" | "done";

const TONE_TEXT: Record<Tone, string> = {
  bull: "text-bull",
  bear: "text-bear",
  neutral: "text-fg",
  warn: "text-amber",
  info: "text-cyan",
};

const VERDICT_BG: Record<string, string> = {
  buy: "bg-bull/15 text-bull border-bull/30",
  sell: "bg-bear/15 text-bear border-bear/30",
  hold: "bg-fg/5 text-fg-dim border-border",
  warn: "bg-amber/15 text-amber border-amber/30",
};

// Provenance badge tint per source tone.
const BADGE_CLS: Record<Tone, string> = {
  bull: "border-bull/40 text-bull",
  bear: "border-bear/40 text-bear",
  neutral: "border-border text-fg-dim",
  warn: "border-amber/40 text-amber",
  info: "border-cyan/40 text-cyan",
};

export function BotCell({
  index,
  active,
  def,
  result,
  candles,
  symbol,
  beginner,
  onUpdateParams,
  onRemove,
  onToggleCollapse,
  onRerun,
}: {
  index: number;
  active: ActiveBot;
  def: BotDef;
  result: BotResult | null;
  candles: Candle[];
  symbol: string;
  beginner: boolean;
  onUpdateParams: (params: Record<string, number | string | boolean>) => void;
  onRemove: () => void;
  onToggleCollapse: () => void;
  onRerun: () => void;
}) {
  const [paramsOpen, setParamsOpen] = useState(false);
  // Q6: '?', 'params' and '✕' live behind one '⋯' — five always-on controls
  // per header made 4+ stacked cells read as a wall of touching buttons.
  const [menuOpen, setMenuOpen] = useState(false);
  const cls = closes(candles);

  /**
   * Phase machine
   * ─────────────
   * The cell renders the BotResult through a four-stage animation any time
   * a fresh result arrives:
   *
   *   idle        → no result yet, show the "press ▶ run" placeholder
   *   streaming   → result has landed but we're showing the typewriter
   *                 log to give the run presence
   *   decimating  → log fades, metrics + verdict reveal with the
   *                 reversed-decimation scramble on numeric values
   *   done        → static, idle render
   *
   * We detect a "fresh" result by tracking the previous result reference
   * and only firing the animation when it changes. This means clicking
   * ▶ run a second time on an already-computed cell still re-plays the
   * sequence (because runOne in QuantPage assigns a new object each
   * call), which is the desired UX.
   *
   * The phase deliberately ignores `result` *content equality*; we want
   * the same numeric output coming back from a re-run to still feel like
   * "it ran again."
   */
  const [phase, setPhase] = useState<Phase>(result ? "done" : "idle");
  const prevResultRef = useRef<BotResult | null>(result);

  useEffect(() => {
    if (result === null || result === undefined) {
      setPhase("idle");
      prevResultRef.current = null;
      return;
    }
    if (prevResultRef.current === result) return; // unchanged ref → no replay
    prevResultRef.current = result;
    setPhase("streaming");
  }, [result]);

  // streaming → decimating handled by RunStream's onComplete
  // decimating → done handled here so the timer is colocated with the phase
  useEffect(() => {
    if (phase !== "decimating") return;
    const t = setTimeout(() => setPhase("done"), DECIMATE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const handleStreamComplete = () => setPhase("decimating");
  const decimating = phase === "decimating";

  const verdictCls = result ? VERDICT_BG[result.verdict.side] : VERDICT_BG.hold;
  const srcMeta = result ? SOURCE_META[result.source ?? sourceForCategory(def.category)] : null;
  const isRunning = phase === "streaming";

  return (
    <div className="relative surface-instrument border border-border bg-surface text-fg">
      {isRunning && <span className="cell-running-rail" aria-hidden />}
      {/* Cell header */}
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[0.625rem] text-fg-faint">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="grid size-6 place-items-center border border-border bg-bg font-mono text-[0.75rem] text-bull">
            {def.glyph}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-display text-base tracking-tightest">
              {def.name}
              <span className="hidden t-chrome text-fg-faint sm:inline">
                / {def.category}
              </span>
            </div>
            <div className="hidden t-chrome leading-tight text-fg-dim sm:line-clamp-2">
              {def.tagline}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRerun}
            disabled={isRunning}
            className={`h-7 border px-2 font-mono text-[0.625rem] uppercase tracking-wider transition-colors ${
              isRunning
                ? "border-bull/40 bg-bull/10 text-bull cursor-wait"
                : "border-border bg-bg text-bull hover:bg-bull hover:text-bg"
            }`}
          >
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                running
              </span>
            ) : (
              "▶ run"
            )}
          </button>
          <button
            onClick={onToggleCollapse}
            className="h-7 w-7 grid place-items-center border border-border bg-bg font-mono text-[0.625rem] text-fg-dim hover:text-fg"
            title={active.collapsed ? "expand" : "collapse"}
          >
            {active.collapsed ? "▾" : "▴"}
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="more"
              className={`h-7 w-7 grid place-items-center border bg-bg font-mono text-[0.625rem] ${
                menuOpen ? "border-fg-dim text-fg" : "border-border text-fg-dim hover:border-fg-dim hover:text-fg"
              }`}
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                {/* click-away scrim — closes the menu without stealing the click */}
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-20 mt-1 w-40 surface-instrument border border-border bg-surface shadow-2xl"
                >
                  <a
                    href={`/learn/bots/${def.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-2.5 py-2 font-mono text-[0.625rem] uppercase tracking-wider text-fg-dim hover:bg-bg hover:text-cyan"
                  >
                    ? how it works
                  </a>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setParamsOpen((v) => !v);
                      setMenuOpen(false);
                    }}
                    className="block w-full border-t border-border-soft px-2.5 py-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-fg-dim hover:bg-bg hover:text-fg"
                  >
                    {paramsOpen ? "hide params" : "params"}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onRemove();
                    }}
                    className="block w-full border-t border-border-soft px-2.5 py-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-fg-dim hover:bg-bear hover:text-bg"
                  >
                    ✕ remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Param panel */}
      {paramsOpen && (
        <div className="grid grid-cols-1 gap-3 border-b border-border bg-bg p-3 sm:grid-cols-2 lg:grid-cols-3">
          {def.params.map((spec) => (
            <ParamControl
              key={spec.key}
              spec={spec}
              value={active.params[spec.key]}
              onChange={(v) => onUpdateParams({ ...active.params, [spec.key]: v })}
            />
          ))}
          {def.formula && (
            <div className="col-span-full border border-border-soft bg-bg-soft px-3 py-2 font-mono text-[0.6875rem] text-fg-dim">
              <span className="text-fg-faint">f(x) = </span>
              {def.formula}
            </div>
          )}
          {(def.endpoint || def.module) && (
            <div className="col-span-full grid grid-cols-1 gap-2 border border-border-soft bg-bg-soft px-3 py-2 font-mono text-[0.625rem] sm:grid-cols-2">
              {def.endpoint && (
                <div className="text-fg-dim">
                  <span className="t-chrome text-fg-faint mr-2">api</span>
                  <span className="text-cyan">{def.endpoint}</span>
                </div>
              )}
              {def.module && (
                <div className="text-fg-dim truncate">
                  <span className="t-chrome text-fg-faint mr-2">src</span>
                  <span className="text-fg">{def.module}</span>
                </div>
              )}
              <div className="col-span-full text-fg-faint text-[0.625rem] flex items-center justify-between gap-3">
                <span>
                  this bot&apos;s output source is shown on its card — on-device NN (WASM), hosted API, exact math, or snapshot. hover the badge for what it means.
                </span>
                <a
                  href={`/learn/bots/${def.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-cyan hover:underline"
                >
                  ↗ How does this work?
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {!active.collapsed && (
        <div className="p-3">
          {!result || phase === "idle" ? (
            <div className="grid h-32 place-items-center t-chrome text-fg-faint">
              press ▶ run
            </div>
          ) : phase === "streaming" ? (
            <RunStream
              def={def}
              symbol={symbol}
              bars={candles.length}
              params={active.params}
              durationMs={STREAM_MS}
              onComplete={handleStreamComplete}
            />
          ) : (
            <div className="space-y-3 cell-result-in">
              {/* Verdict + provenance */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 border px-2 py-1 t-chrome ${verdictCls}`}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  <DecimatedNumber
                    value={result.verdict.side.toUpperCase()}
                    duration={DECIMATE_MS - 80}
                    active={decimating}
                  />
                </span>
                <span className="text-[0.75rem] text-fg">{result.verdict.text}</span>

                <div className="ml-auto flex items-center gap-2">
                  {/* honest source badge — hover for what it is */}
                  {srcMeta && (
                    <span
                      title={`${srcMeta.tip}${result.sourceNote ? `\n\n(${result.sourceNote})` : ""}`}
                      className={`inline-flex cursor-help items-center gap-1.5 border px-1.5 py-0.5 t-chrome ${BADGE_CLS[srcMeta.tone]}`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {srcMeta.label}
                    </span>
                  )}
                  {result.horizon && (
                    <span
                      title="Prediction horizon"
                      className="border border-border px-1.5 py-0.5 t-chrome text-fg-faint"
                    >
                      {result.horizon}
                    </span>
                  )}
                  {typeof result.verdict.confidence === "number" && (
                    <span
                      title="Model confidence in this verdict"
                      className="t-chrome text-fg-faint"
                    >
                      conf{" "}
                      <DecimatedNumber
                        value={`${Math.min(100, Math.max(0, result.verdict.confidence * 100)).toFixed(0)}%`}
                        duration={DECIMATE_MS - 100}
                        active={decimating}
                        className="text-fg"
                      />
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4">
                {result.metrics.map((m) => (
                  <div
                    key={m.key}
                    title={m.hint || undefined}
                    className={`bg-bg p-2.5 ${m.hint ? "cursor-help" : ""}`}
                  >
                    <div className="t-chrome text-fg-faint">
                      {m.label}
                    </div>
                    <div className={`mt-1 t-data text-base ${TONE_TEXT[m.tone ?? "neutral"]}`}>
                      <DecimatedNumber
                        value={String(m.value)}
                        duration={DECIMATE_MS}
                        active={decimating}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart with overlay */}
              {(result.overlay && result.overlay.length > 0) || result.signals.length > 0 ? (
                <div className="relative h-[10rem] overflow-hidden border border-border-soft bg-bg">
                  <PriceWithOverlay
                    closes={cls}
                    overlay={result.overlay ?? []}
                    signals={result.signals}
                    height={160}
                    width={720}
                  />
                  <div className="absolute left-2 top-1.5 flex gap-3 bg-bg/70 px-1 t-chrome text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 bg-fg" /> close
                    </span>
                    {(result.overlay ?? []).map((o) => (
                      <span key={o.label} className="flex items-center gap-1.5">
                        <span className="size-1.5" style={{ background: o.color }} />
                        {o.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Pane (RSI/MACD/Z-score) */}
              {result.pane && (
                <div className="relative overflow-hidden border border-border-soft bg-bg" style={{ height: result.pane.height ?? 80 }}>
                  <PaneLine
                    series={result.pane.series}
                    refLines={result.pane.refLines}
                    height={result.pane.height ?? 80}
                    width={720}
                    histogram={result.pane.kind === "histogram"}
                  />
                  <div className="absolute left-2 top-1.5 flex gap-3 bg-bg/70 px-1 t-chrome text-fg-faint">
                    {result.pane.series.map((s) => (
                      <span key={s.label} className="flex items-center gap-1.5">
                        <span className="size-1.5" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Equity curve from backtest */}
              {result.equity && result.equity.length > 5 && (
                <div className="flex items-center gap-3 border border-border-soft bg-bg p-2">
                  <span className="t-chrome text-fg-faint">equity</span>
                  <div className="h-8 flex-1">
                    <EquitySpark equity={result.equity} width={400} height={32} />
                  </div>
                  <span className={`t-data text-[0.6875rem] ${result.equity[result.equity.length - 1] >= result.equity[0] ? "text-bull" : "text-bear"}`}>
                    <DecimatedNumber
                      value={`${((result.equity[result.equity.length - 1] / result.equity[0] - 1) * 100).toFixed(1)}%`}
                      duration={DECIMATE_MS}
                      active={decimating}
                    />
                  </span>
                </div>
              )}

              {/* Beginner blurb */}
              {beginner && result.beginner && (
                <div className="border-l-2 border-bull bg-bull/5 px-3 py-2 text-[0.75rem] leading-relaxed text-fg">
                  <span className="mr-2 t-chrome text-bull">teacher</span>
                  {result.beginner}
                </div>
              )}

              {/* Summary */}
              <div className="font-mono text-[0.6875rem] tracking-wide text-fg-dim">
                <span className="text-fg-faint">→ </span>
                {result.summary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParamControl({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: number | string | boolean | undefined;
  onChange: (v: number | string | boolean) => void;
}) {
  if (spec.kind === "select") {
    const v = (value as string) ?? spec.default;
    return (
      <label className="flex flex-col gap-1">
        <span className="t-chrome text-fg-faint">{spec.label}</span>
        <select
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 border border-border bg-bg px-2 font-mono text-[0.75rem] text-fg"
        >
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (spec.kind === "boolean") {
    const v = (value as boolean) ?? spec.default;
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} className="accent-bull" />
        <span className="t-chrome text-fg-dim">{spec.label}</span>
      </label>
    );
  }
  // number
  const v = (value as number) ?? spec.default;
  const min = spec.min ?? 0;
  const max = spec.max ?? 100;
  const step = spec.step ?? 1;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between t-chrome text-fg-faint">
        <span>{spec.label}</span>
        <span className="text-fg">
          {typeof v === "number" ? v : Number(v)}
          {spec.unit ?? ""}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full accent-bull"
      />
      {spec.hint && (
        <span className="font-mono text-[0.625rem] text-fg-faint">{spec.hint}</span>
      )}
    </label>
  );
}
