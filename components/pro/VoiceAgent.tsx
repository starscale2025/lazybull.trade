"use client";

// The floating LazyBull voice co-pilot for the /pro workspace.
// Owns the persona choice + auto-greet preference, feeds a live snapshot of the
// chart into the voice engine, and renders the orb / transcript / trade-confirm UI.
// Scoped entirely to /pro — mounted only by app/pro/page.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Bar } from "./chartCore";
import type { QuoteMeta } from "@/lib/pro/voice/analysis";
import { PERSONAS, DEFAULT_PERSONA, type PersonaId } from "@/lib/pro/voice/personality";
import { useVoiceAgent, type VoiceActions, type VoiceSnapshot } from "@/lib/pro/voice/useVoiceAgent";
import { useFreeVoiceAgent } from "@/lib/pro/voice/useFreeVoiceAgent";

// "free" (default) = browser speech + OpenRouter free model, $0.
// "openai"        = paid OpenAI Realtime voice. Set NEXT_PUBLIC_VOICE_PROVIDER=openai to switch.
const USE_OPENAI = (process.env.NEXT_PUBLIC_VOICE_PROVIDER ?? "free") === "openai";

type SymbolDef = { sym: string; name: string; exch: string };

type Props = {
  symbol: SymbolDef;
  timeframe: string;
  bars: Bar[];
  meta: QuoteMeta;
  indicators: string[];
  actions: VoiceActions;
};

const PERSONA_KEY = "lb-pro-voice-persona";
const AUTO_KEY = "lb-pro-voice-auto";
const IDLE_MS = 180_000; // auto-disconnect after 3 min idle (cost guard)

export function VoiceAgent({ symbol, timeframe, bars, meta, indicators, actions }: Props) {
  // live snapshot the engine reads on demand
  const inputsRef = useRef<VoiceSnapshot>({ symbol: symbol.sym, name: symbol.name, exch: symbol.exch, timeframe, bars, meta, indicators });
  inputsRef.current = { symbol: symbol.sym, name: symbol.name, exch: symbol.exch, timeframe, bars, meta, indicators };
  const getSnapshot = useCallback((): VoiceSnapshot => inputsRef.current, []);

  const [persona, setPersona] = useState<PersonaId>(DEFAULT_PERSONA);
  // OFF by default. Auto-connecting opened the microphone the moment the chart
  // loaded — before the user had asked for anything — which fires a browser
  // permission prompt on arrival and leaves a live mic on a page whose job is
  // charts. Grabbing a device unprompted is the user's call to make, so this is
  // strictly opt-in and the preference persists once they do.
  const [autoGreet, setAutoGreet] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // hydrate prefs
  useEffect(() => {
    try {
      const p = localStorage.getItem(PERSONA_KEY) as PersonaId | null;
      if (p && PERSONAS[p]) setPersona(p);
      // Opt-IN: only a stored "on" enables it. An older install that saved
      // nothing (or "off") correctly stays silent.
      if (localStorage.getItem(AUTO_KEY) === "on") setAutoGreet(true);
    } catch {}
  }, []);

  // Both engines share one interface. We call both hooks unconditionally (Rules
  // of Hooks) but only drive the selected one — the other never connects, so it
  // holds no mic/network. NEXT_PUBLIC_VOICE_PROVIDER picks at build time.
  const freeEngine = useFreeVoiceAgent({ getSnapshot, actions, persona });
  const openaiEngine = useVoiceAgent({ getSnapshot, actions, persona });
  const voice = USE_OPENAI ? openaiEngine : freeEngine;
  const { status, error, muted, needsTap, speaking, transcript, stagedTrade, interim, listening, micError } = voice;
  // These callbacks are stable across renders — depend on THEM in effects, never
  // on the whole `voice` object (which is a fresh literal each render and would
  // otherwise reset the idle timer on every 30s quote poll).
  const { connect, disconnect, reconnect } = voice;

  // Auto-greet once, after the first bars land — only when explicitly enabled.
  const autoTried = useRef(false);
  useEffect(() => {
    if (!autoGreet || autoTried.current) return;
    if (bars.length > 0 && status === "idle") {
      autoTried.current = true;
      connect();
    }
  }, [autoGreet, bars.length, status, connect]);

  // idle auto-disconnect (don't burn tokens while the user is heads-down).
  // Deps are all stable except status/transcript/speaking, which only change on
  // real activity — so during true idle the timer survives to IDLE_MS and fires.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== "live") return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      actions.showToast?.("🎙 Voice paused after 3 min idle — tap to wake", "ok");
      disconnect();
    }, IDLE_MS);
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [status, transcript, speaking, actions, disconnect]);

  const changePersona = (id: PersonaId) => {
    setPersona(id);
    try { localStorage.setItem(PERSONA_KEY, id); } catch {}
    if (status === "live" || status === "connecting") reconnect(id);
  };

  const toggleAuto = () => {
    setAutoGreet((v) => {
      const next = !v;
      try { localStorage.setItem(AUTO_KEY, next ? "on" : "off"); } catch {}
      return next;
    });
  };

  const onOrbClick = () => {
    // idle → start a session; any other state → toggle the panel so the
    // transcript, controls, and any error+retry are visible.
    if (status === "idle") connect();
    else setOpen((o) => !o);
  };

  const statusLabel = useMemo(() => {
    if (status === "connecting") return "connecting…";
    if (status === "error") return error || "error";
    if (status === "live") {
      if (speaking) return "speaking…";
      if (muted) return "mic off";
      return listening ? "listening…" : "thinking…";
    }
    return "tap to wake";
  }, [status, error, speaking, muted, listening]);

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const live = status === "live";
  const connecting = status === "connecting";

  return (
    <div className="fixed bottom-4 right-4 z-[120] flex flex-col items-end gap-2 font-mono">
      {/* Panel */}
      <AnimatePresence>
        {open && (status === "live" || status === "connecting" || status === "error") && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="w-[340px] overflow-hidden border border-bull/40 bg-bg shadow-2xl"
          >
            {/* header */}
            <div className="flex items-center gap-2 border-b border-border bg-bg-soft px-3 py-2 text-[10px] uppercase tracking-[0.2em]">
              <span className={`size-2 rounded-full ${live ? "bg-bull animate-pulse" : connecting ? "bg-cyan animate-pulse" : "bg-bear"}`} />
              <span className="text-bull">LazyBull</span>
              <span className="text-fg-faint">· {statusLabel}</span>
              <button onClick={() => setOpen(false)} className="ml-auto text-fg-faint hover:text-fg" aria-label="Collapse">✕</button>
            </div>

            {/* persona + controls */}
            <div className="flex items-center gap-1 border-b border-border-soft bg-surface/40 px-2 py-1.5">
              <select
                value={persona}
                onChange={(e) => changePersona(e.target.value as PersonaId)}
                className="flex-1 border border-border bg-bg px-1.5 py-1 text-[10px] uppercase tracking-wider text-fg-dim outline-none hover:text-fg"
                aria-label="Personality"
              >
                {Object.values(PERSONAS).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={voice.toggleMute}
                className={`border px-2 py-1 text-[10px] uppercase tracking-wider ${muted ? "border-bear/60 text-bear" : "border-border text-fg-dim hover:text-fg"}`}
                title={muted ? "Unmute mic" : "Mute mic"}
              >
                {muted ? "mic off" : "mic on"}
              </button>
              <button
                onClick={voice.disconnect}
                className="border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-fg-dim hover:text-bear"
                title="End session"
              >
                end
              </button>
            </div>

            {/* mic problem — always visible, never silently swallowed */}
            {micError && (
              <div className="border-b border-amber/40 bg-amber/10 px-3 py-1.5 text-[10px] leading-snug text-amber">
                🎙 {micError}
                <a href="/pro/mic-check" target="_blank" rel="noreferrer" className="ml-1 underline hover:text-fg">run mic check</a>
              </div>
            )}

            {/* tap-to-hear banner (autoplay blocked) */}
            {needsTap && (
              <button onClick={voice.tapToHear} className="w-full border-b border-amber/40 bg-amber/10 px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-amber">
                🔊 tap to enable audio
              </button>
            )}

            {/* error */}
            {status === "error" && (
              <div className="border-b border-bear/40 bg-bear/10 px-3 py-2 text-[10px] text-bear">
                {error}
                <button onClick={() => connect()} className="ml-2 underline hover:text-fg">retry</button>
              </div>
            )}

            {/* transcript */}
            <div ref={transcriptRef} className="max-h-64 min-h-24 space-y-2 overflow-y-auto px-3 py-3">
              {transcript.length === 0 && (
                <div className="py-6 text-center text-[10px] lowercase tracking-wide text-fg-faint">
                  {connecting ? "waking up…" : "say something — “what’s the market doing?”"}
                </div>
              )}
              {transcript.map((t) => (
                <div key={t.id} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-2.5 py-1.5 text-[11px] leading-snug ${
                      t.role === "user" ? "bg-bull/15 text-fg" : "bg-surface text-fg-dim"
                    }`}
                  >
                    {t.text || "…"}
                  </div>
                </div>
              ))}
              {/* live interim — proof the mic is picking you up as you speak */}
              {interim && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] border border-dashed border-bull/50 px-2.5 py-1.5 text-[11px] italic leading-snug text-fg-dim">
                    {interim}…
                  </div>
                </div>
              )}
            </div>

            {/* staged trade confirmation */}
            <AnimatePresence>
              {stagedTrade && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-amber/50 bg-amber/10 px-3 py-2.5"
                >
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-amber">⚡ confirm paper order</div>
                  <div className="mb-2.5 text-[11px] leading-snug text-fg">
                    <span className={stagedTrade.side === "buy" ? "text-bull" : "text-bear"}>{stagedTrade.side.toUpperCase()}</span>{" "}
                    {stagedTrade.qty} {stagedTrade.sym} · {stagedTrade.orderType}
                    {stagedTrade.orderType === "limit" ? ` @ $${stagedTrade.estPrice.toFixed(2)}` : " @ market"} · ~${stagedTrade.estValue.toFixed(2)}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={voice.confirmStagedFromUI} className="flex-1 bg-bull py-1.5 text-[10px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim">
                      confirm
                    </button>
                    <button onClick={voice.cancelStagedFromUI} className="flex-1 border border-border py-1.5 text-[10px] uppercase tracking-wider text-fg-dim hover:text-bear">
                      cancel
                    </button>
                  </div>
                  <div className="mt-1.5 text-[9px] lowercase text-fg-faint">simulated · stored locally · reversible</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* text fallback + auto toggle */}
            <div className="border-t border-border-soft">
              <form
                onSubmit={(e) => { e.preventDefault(); if (draft.trim() && live) { voice.sendText(draft); setDraft(""); } }}
                className="flex items-center gap-1 px-2 py-1.5"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={live ? "type instead of talking…" : "connect to chat"}
                  disabled={!live}
                  className="flex-1 border border-border bg-bg px-2 py-1 text-[11px] text-fg outline-none placeholder:text-fg-faint disabled:opacity-50"
                />
                <button type="submit" disabled={!live || !draft.trim()} className="border border-border px-2 py-1 text-[11px] text-fg-dim hover:text-fg disabled:opacity-40">↵</button>
              </form>
              <button onClick={toggleAuto} className="w-full px-3 pb-1.5 text-left text-[9px] uppercase tracking-wider text-fg-faint hover:text-fg-dim">
                auto-greet on open: <span className={autoGreet ? "text-bull" : "text-fg-faint"}>{autoGreet ? "on" : "off"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb */}
      <button
        onClick={onOrbClick}
        aria-label="LazyBull voice co-pilot"
        className="group relative flex size-14 items-center justify-center rounded-full border border-bull/50 bg-bg-soft shadow-xl transition-transform hover:scale-105 active:scale-95"
      >
        {/* pulse rings when live/speaking */}
        {live && (
          <>
            <span className={`absolute inset-0 rounded-full border border-bull/40 ${speaking ? "animate-ping" : "animate-pulse"}`} />
            {speaking && <span className="absolute -inset-1 rounded-full border border-bull/20 animate-ping" style={{ animationDelay: "150ms" }} />}
          </>
        )}
        {connecting && <span className="absolute inset-0 rounded-full border-2 border-cyan/40 border-t-cyan animate-spin" />}

        {/* mic glyph */}
        <span className={`relative flex size-9 items-center justify-center rounded-full ${live ? "bg-bull text-bg" : status === "error" ? "bg-bear/20 text-bear" : "bg-bull/15 text-bull"}`}>
          {muted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="2" x2="22" y2="22" /><path d="M18.9 13.4A7 7 0 0 0 19 12v-1" /><path d="M9 5a3 3 0 0 1 6 0v5" /><path d="M12 19v3" /><path d="M5 11a7 7 0 0 0 10.3 6.2" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="22" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
