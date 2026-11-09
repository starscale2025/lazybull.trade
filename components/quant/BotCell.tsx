"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveBot, BotDef, BotResult, ParamSpec, Tone } from "@/lib/quant/types";
import { SOURCE_META, sourceForCategory } from "@/lib/quant/provenance";
import { READ } from "@/lib/quant/reads";
import { closes } from "@/lib/quant/series";
import type { Candle } from "@/lib/candles";
import { Chip, ToolButton, type ChipTone } from "@/components/calm/kit";
import { PriceWithOverlay, PaneLine, EquitySpark } from "./MiniViz";
import { RunStream } from "./RunStream";
import { DecimatedNumber } from "./DecimatedNumber";
import { sentence } from "./sentence";

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

const VERDICT_TONE: Record<string, ChipTone> = {
  buy: "gain",
  sell: "loss",
  hold: "neutral",
  warn: "warn",
};

// Metric grid columns by count, so as few slots as possible sit empty showing
// the border colour (3 → 3 across, 6 → 3 + 3); four across otherwise.
const METRIC_COLS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  5: "sm:grid-cols-3",
  6: "sm:grid-cols-3",
  9: "sm:grid-cols-3",
};

// Provenance chip per source tone. Only the warning keeps a colour: where a
// number came from is not a gain or a loss.
const BADGE_TONE: Record<Tone, ChipTone> = {
  bull: "brand",
  bear: "neutral",
  neutral: "neutral",
  warn: "warn",
  info: "neutral",
};

/** A compact header control: the kit's square at the cell header's height. */
const HEADER_ICON_BTN = "!size-7 !p-0 !text-[0.75rem]";
const MENU_ITEM = "t-label block w-full px-2.5 py-2 text-left text-fg-dim hover:bg-fg/5 hover:text-fg";

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

  const srcMeta = result ? SOURCE_META[result.source ?? sourceForCategory(def.category)] : null;
  const isRunning = phase === "streaming";

  return (
    <div className="calm-panel text-fg">
      <i aria-hidden className="lit-aura" />
      {/* Held clear of the 22px corners, where a straight rail would poke out. */}
      {isRunning && <span className="cell-running-rail !left-5 !right-5" aria-hidden />}
      {/* Cell header */}
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="t-label tabular-nums text-fg-faint">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fg/[0.07] text-[0.75rem] text-brand-ink">
            {def.glyph}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em]">
              {def.name}
              <span className="t-label hidden font-normal text-fg-faint sm:inline">
                {def.category === "ai" ? "AI" : sentence(def.category)}
              </span>
            </div>
            <div className="t-label hidden text-fg-dim sm:line-clamp-2">
              {def.tagline}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ToolButton
            onClick={onRerun}
            disabled={isRunning}
            className={`!h-7 !px-2 !text-[0.75rem] ${isRunning ? "!cursor-wait !opacity-100" : ""}`}
          >
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-current pulse-dot" />
                Running
              </span>
            ) : (
              "▶ Run"
            )}
          </ToolButton>
          <ToolButton
            onClick={onToggleCollapse}
            className={HEADER_ICON_BTN}
            title={active.collapsed ? "expand" : "collapse"}
          >
            {active.collapsed ? "▾" : "▴"}
          </ToolButton>
          <div className="relative">
            <ToolButton
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="more"
              className={HEADER_ICON_BTN}
            >
              ⋯
            </ToolButton>
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
                    className={MENU_ITEM}
                  >
                    ? How it works
                  </a>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setParamsOpen((v) => !v);
                      setMenuOpen(false);
                    }}
                    className={`${MENU_ITEM} border-t border-border-soft`}
                  >
                    {paramsOpen ? "Hide params" : "Params"}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onRemove();
                    }}
                    className={`${MENU_ITEM} border-t border-border-soft`}
                  >
                    ✕ Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Param panel */}
      {paramsOpen && (
        <div className="grid grid-cols-1 gap-3 border-b border-border-soft p-4 sm:grid-cols-2 lg:grid-cols-3">
          {def.params.map((spec) => (
            <ParamControl
              key={spec.key}
              spec={spec}
              value={active.params[spec.key]}
              onChange={(v) => onUpdateParams({ ...active.params, [spec.key]: v })}
            />
          ))}
          {def.formula && (
            <div className="col-span-full rounded-[var(--r-instrument)] border border-border-soft bg-bg-soft px-3 py-2 font-mono text-[0.6875rem] text-fg-dim">
              <span className="text-fg-faint">f(x) = </span>
              {def.formula}
            </div>
          )}
          {(def.endpoint || def.module) && (
            <div className="col-span-full grid grid-cols-1 gap-2 rounded-[var(--r-instrument)] border border-border-soft bg-bg-soft px-3 py-2 font-mono text-[0.625rem] sm:grid-cols-2">
              {def.endpoint && (
                <div className="text-fg-dim">
                  <span className="t-label text-fg-faint mr-2">API</span>
                  <span className="text-brand-ink">{def.endpoint}</span>
                </div>
              )}
              {def.module && (
                <div className="text-fg-dim truncate">
                  <span className="t-label text-fg-faint mr-2">Src</span>
                  <span className="text-fg">{def.module}</span>
                </div>
              )}
              <div className="t-label col-span-full text-fg-faint flex items-center justify-between gap-3">
                <span>
                  This bot’s output source is shown on its card — on-device NN (WASM), hosted API, exact math, or snapshot. Hover the badge for what it means.
                </span>
                <a
                  href={`/learn/bots/${def.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="calm-link !text-[0.75rem] shrink-0"
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
        <div className="p-4">
          {!result || phase === "idle" ? (
            <div className="grid h-32 place-items-center t-label text-fg-faint">
              Press ▶ run
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
                <Chip tone={VERDICT_TONE[result.verdict.side]} dot>
                  <DecimatedNumber
                    value={sentence(READ[result.verdict.side])}
                    duration={DECIMATE_MS - 80}
                    active={decimating}
                  />
                </Chip>
                <span className="text-[0.75rem] text-fg">{result.verdict.text}</span>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {/* honest source chip — hover for what it is */}
                  {srcMeta && (
                    <span
                      title={`${srcMeta.tip}${result.sourceNote ? `\n\n(${result.sourceNote})` : ""}`}
                      className="inline-flex cursor-help"
                    >
                      <Chip tone={BADGE_TONE[srcMeta.tone]} dot>
                        {srcMeta.label}
                      </Chip>
                    </span>
                  )}
                  {/* On the card, not in a tooltip: the read is of this day's
                      window, and only that makes it history (lib/quant/reads). */}
                  {result.asOf && (
                    <span className="inline-flex" title="The last session this model read. Everything after it is what the tape did next.">
                      <Chip>As of {result.asOf}</Chip>
                    </span>
                  )}
                  {result.horizon && (
                    <span className="inline-flex" title="How many sessions after the window the model read">
                      <Chip>{sentence(result.horizon)}</Chip>
                    </span>
                  )}
                  {/* No confidence chip (Gate A3, 2026-11). It printed
                      verdict.confidence as "CONF 95%" beside the one
                      historical hit-rate band, and that number was never
                      odds: each bot scales its own signal into 0-1, and the
                      consensus card mapped its agreement tier straight to
                      95/78/55/30. A per-card percentage next to a hit rate
                      reads as the chance this read is right. What a card can
                      honestly say about agreement it already says in its
                      metrics ("Models agreeing 5 / 6"). */}
                </div>
              </div>

              {/* Metrics */}
              <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-instrument)] border border-border bg-border ${METRIC_COLS[result.metrics.length] ?? "sm:grid-cols-4"}`}>
                {result.metrics.map((m) => (
                  <div
                    key={m.key}
                    title={m.hint || undefined}
                    className={`bg-bg p-2.5 ${m.hint ? "cursor-help" : ""}`}
                  >
                    <div className="t-label text-fg-faint">
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
                <div className="relative h-[10rem] overflow-hidden rounded-[var(--r-instrument)] border border-border-soft bg-bg">
                  <PriceWithOverlay
                    closes={cls}
                    overlay={result.overlay ?? []}
                    signals={result.signals}
                    height={160}
                    width={720}
                  />
                  <div className="t-label absolute left-2 top-1.5 flex gap-3 bg-bg/70 px-1 text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 bg-fg" /> Close
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
                <div className="relative overflow-hidden rounded-[var(--r-instrument)] border border-border-soft bg-bg" style={{ height: result.pane.height ?? 80 }}>
                  <PaneLine
                    series={result.pane.series}
                    refLines={result.pane.refLines}
                    height={result.pane.height ?? 80}
                    width={720}
                    histogram={result.pane.kind === "histogram"}
                  />
                  <div className="t-label absolute left-2 top-1.5 flex gap-3 bg-bg/70 px-1 text-fg-faint">
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
                <div className="flex items-center gap-3 rounded-[var(--r-instrument)] border border-border-soft bg-bg p-2">
                  <span className="t-label text-fg-faint">Equity</span>
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
                <div className="rounded-[var(--r-instrument)] bg-brand-ink/[0.08] px-3 py-2 text-[0.75rem] leading-relaxed text-fg">
                  <span className="t-label mr-2 font-medium text-brand-ink">Teacher</span>
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
        <span className="t-label text-fg-faint">{spec.label}</span>
        <select
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="calm-input !h-8"
        >
          {spec.options.map((o) => (
            <option key={o.value} value={o.value} className="bg-bg text-fg">
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
        <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} className="accent-brand-ink" />
        <span className="t-label text-fg-dim">{spec.label}</span>
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
      <span className="flex items-center justify-between t-label text-fg-faint">
        <span>{spec.label}</span>
        <span className="tabular-nums text-fg">
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
        className="h-1 w-full accent-brand-ink"
      />
      {spec.hint && (
        <span className="t-label text-fg-faint">{spec.hint}</span>
      )}
    </label>
  );
}
