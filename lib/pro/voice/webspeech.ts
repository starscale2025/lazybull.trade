"use client";

// Free, no-key voice I/O using the browser's built-in Web Speech API.
// - Listening: SpeechRecognition (Chrome/Edge send audio to Google's STT, free)
// - Speaking:  speechSynthesis (offline, free)
// The brain (what to say / which tools to call) is a separate LLM call — this
// module only handles ears + mouth. Works best in Chrome/Edge; Safari partial;
// Firefox has no SpeechRecognition (we degrade to text-only there).

/* eslint-disable @typescript-eslint/no-explicit-any */

export const sttSupported = (): boolean =>
  typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export const ttsSupported = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

// SpeechRecognition needs a secure context (https, or localhost).
export const secureContextOk = (): boolean =>
  typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1");

// ── Recognizer ───────────────────────────────────────────────────────────
export type RecognizerState = {
  running: boolean;
  enabled: boolean;
  starts: number;
  ends: number;
  results: number;
  lastError: string | null;
};

export type Recognizer = {
  start: () => void;
  stop: () => void;
  setEnabled: (on: boolean) => void; // gate results (e.g. while the agent speaks)
  destroy: () => void;
  getState: () => RecognizerState;
};

export function createRecognizer(opts: {
  lang?: string;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  onEvent?: (name: string, detail?: string) => void; // diagnostics hook
}): Recognizer | null {
  if (!sttSupported()) return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = opts.lang || "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let enabled = true;
  let wantRunning = false;
  let running = false;
  let destroyed = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let fails = 0;
  const stats = { starts: 0, ends: 0, results: 0, lastError: null as string | null };

  const log = (name: string, detail?: string) => opts.onEvent?.(name, detail);

  // Chrome ends a recognition session on its own (silence, ~60s cap, transient
  // errors). Restarting synchronously inside `onend` can throw InvalidStateError
  // and used to kill listening permanently — so always restart on a timer, with
  // backoff, and keep retrying.
  const scheduleRestart = (delay = 300) => {
    if (destroyed || !wantRunning || restartTimer) return;
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (destroyed || !wantRunning || running) return;
      try {
        rec.start();
        running = true;
        fails = 0;
        log("restart");
      } catch (e) {
        fails++;
        log("restart-failed", (e as Error)?.message);
        if (fails < 12) scheduleRestart(Math.min(3000, 300 * fails));
        else opts.onError?.("recognition-stuck");
      }
    }, delay);
  };

  rec.onstart = () => { running = true; stats.starts++; log("start"); };
  rec.onaudiostart = () => log("audiostart");
  rec.onsoundstart = () => log("soundstart");
  rec.onspeechstart = () => log("speechstart");

  rec.onresult = (e: any) => {
    stats.results++;
    if (!enabled) { log("result-ignored(muted/speaking)"); return; }
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r[0]?.transcript ?? "";
      if (r.isFinal) {
        const finalTxt = txt.trim();
        if (finalTxt) { log("final", finalTxt); opts.onFinal(finalTxt); }
      } else {
        interim += txt;
      }
    }
    if (interim.trim()) { log("interim", interim.trim()); opts.onInterim?.(interim.trim()); }
  };

  rec.onerror = (e: any) => {
    const err = e?.error || "error";
    stats.lastError = err;
    log("error", err);
    // no-speech/aborted are routine session churn; surface everything else
    // (not-allowed, audio-capture, network, service-not-allowed, language-...)
    if (err !== "no-speech" && err !== "aborted") opts.onError?.(err);
  };

  rec.onend = () => {
    running = false;
    stats.ends++;
    log("end");
    scheduleRestart();
  };

  return {
    start() {
      wantRunning = true;
      if (running) return;
      try { rec.start(); running = true; log("start-call"); }
      catch (e) { log("start-failed", (e as Error)?.message); scheduleRestart(); }
    },
    stop() {
      wantRunning = false;
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      try { rec.stop(); } catch {}
    },
    setEnabled(on: boolean) {
      enabled = on;
      log(`enabled=${on}`);
      // Critical: the engine may have ended while we were gated off. Re-arming
      // must also make sure it's actually running again.
      if (on && wantRunning && !running) scheduleRestart(50);
    },
    destroy() {
      destroyed = true;
      wantRunning = false;
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      try { rec.onresult = rec.onerror = rec.onend = rec.onstart = null; rec.abort(); } catch {}
    },
    getState: () => ({ running, enabled, ...stats }),
  };
}

// ── Speaker ──────────────────────────────────────────────────────────────
let cachedVoices: SpeechSynthesisVoice[] = [];
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) { cachedVoices = now; return Promise.resolve(now); }
  return new Promise((resolve) => {
    const done = () => { cachedVoices = synth.getVoices(); resolve(cachedVoices); };
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 500); // fallback — some browsers never fire the event
  });
}

// Pick the nicest available English voice, optionally biased by name hints.
export function pickVoice(hints: string[] = []): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length ? cachedVoices : (ttsSupported() ? window.speechSynthesis.getVoices() : []);
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  for (const h of hints) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(h.toLowerCase()));
    if (hit) return hit;
  }
  const nice = pool.find((v) => /(natural|neural|google|samantha|daniel|aaron|zoe)/i.test(v.name));
  return nice || pool[0];
}

export function speak(
  text: string,
  opts: { voice?: SpeechSynthesisVoice | null; rate?: number; pitch?: number; onStart?: () => void; onEnd?: () => void } = {},
): void {
  if (!ttsSupported() || !text.trim()) { opts.onEnd?.(); return; }
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  if (opts.voice) u.voice = opts.voice;
  u.rate = opts.rate ?? 1.05;
  u.pitch = opts.pitch ?? 1;
  u.onstart = () => opts.onStart?.();
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  synth.speak(u);
}

export function cancelSpeech(): void {
  if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch {} }
}

// Chrome's utterance `onend` is unreliable (often never fires). Poll this
// instead as the source of truth for "are we still talking?".
export function isSpeaking(): boolean {
  if (!ttsSupported()) return false;
  try {
    const s = window.speechSynthesis;
    return s.speaking || s.pending;
  } catch { return false; }
}
