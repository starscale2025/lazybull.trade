"use client";

// FREE voice engine: browser Web Speech (ears + mouth) + an OpenRouter free
// text model (brain). Turn-based: listen → think → speak. Mirrors the return
// shape of useVoiceAgent (the paid OpenAI Realtime engine) so VoiceAgent.tsx
// can use either as a drop-in.

import { useCallback, useEffect, useRef, useState } from "react";
import { placePaperOrder } from "@/lib/pro/paper";
import { computeAnalysis } from "./analysis";
import { PERSONAS, DEFAULT_PERSONA, type PersonaId } from "./personality";
import { buildSystemPrompt, buildSnapshotContext, buildWorkspaceContext, parseBrainReply, type ChatMsg, type BrainAction } from "./brainProtocol";
import { dispatchSimpleAction } from "./actionDispatch";
import { isAffirmative, STAGED_TTL_MS } from "./confirm";
import {
  createRecognizer, type Recognizer, ttsSupported, sttSupported,
  loadVoices, pickVoice, speak, cancelSpeech, isSpeaking as ttsIsSpeaking,
} from "./webspeech";
import type {
  VoiceActions, VoiceSnapshot, VoiceStatus, TranscriptEntry, StagedTrade, PlacedOrder,
} from "./useVoiceAgent";

type Args = { getSnapshot: () => VoiceSnapshot; actions: VoiceActions; persona: PersonaId };

const MAX_HISTORY = 12;
const ECHO_COOLDOWN_MS = 600; // wait out our own TTS tail before trusting the mic

// Only genuine self-echo should be dropped. Real echo is a VERBATIM chunk of
// what we just said, arriving immediately after we stopped talking — so this is
// deliberately strict. (An earlier, looser version silently swallowed normal
// commands like "what's the trend", which made the mic look broken.)
const ECHO_WINDOW_MS = 2500; // only suspect echo this soon after TTS ends
function isEcho(userText: string, lastAssistant: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const u = norm(userText);
  const a = norm(lastAssistant);
  if (!u || !a) return false;
  if (u.length >= 15 && a.includes(u)) return true; // substantial verbatim chunk of our own speech
  const ut = u.split(" ");
  const at = new Set(a.split(" "));
  if (ut.length < 6) return false;                  // never judge short commands
  const common = ut.filter((w) => at.has(w)).length;
  return common / ut.length >= 0.85;                // near-identical wording
}

export function useFreeVoiceAgent({ getSnapshot, actions, persona }: Args) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [stagedTrade, setStagedTrade] = useState<StagedTrade | null>(null);
  const [interim, setInterim] = useState(""); // live "we can hear you" feedback
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const recognizerRef = useRef<Recognizer | null>(null);
  const historyRef = useRef<ChatMsg[]>([]);
  const systemPromptRef = useRef<string>("");
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const lastAssistantRef = useRef<string>("");
  const stagedRef = useRef<StagedTrade | null>(null);
  const affirmedSinceStageRef = useRef(false); // did the user affirmatively say yes since staging?
  const stagedAtRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const statusRef = useRef<VoiceStatus>("idle");
  const genRef = useRef(0);                      // per-connection generation — invalidates stale turns
  const abortRef = useRef<AbortController | null>(null);
  const lastSpeechEndAtRef = useRef(0);
  const speechPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechFailsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actionsRef = useRef(actions);
  const snapRef = useRef(getSnapshot);
  const personaRef = useRef<PersonaId>(persona);
  useEffect(() => { actionsRef.current = actions; }, [actions]);
  useEffect(() => { snapRef.current = getSnapshot; }, [getSnapshot]);
  useEffect(() => { personaRef.current = persona; }, [persona]);

  const setStat = useCallback((s: VoiceStatus) => { statusRef.current = s; setStatus(s); }, []);

  const setFinal = useCallback((id: string, role: "user" | "assistant", text: string) => {
    if (!text) return;
    setTranscript((prev) => [...prev, { id, role, text, ts: Date.now() }].slice(-24));
  }, []);

  // ── paper trade (books through the shared account funnel) ──────────────
  const placeStaged = useCallback((): { ok: boolean; order?: PlacedOrder; error?: string } => {
    const st = stagedRef.current;
    if (!st) return { ok: false, error: "no staged trade" };
    // Book through the shared paper account (cash, position, P&L) instead of
    // writing the blotter directly — see lib/pro/paper.ts.
    const placed = placePaperOrder({ sym: st.sym, side: st.side, type: st.orderType, qty: st.qty, price: st.estPrice });
    if (!placed.ok) {
      actionsRef.current.showToast?.(`Order rejected: ${placed.error}`, "warn");
      return { ok: false, error: placed.error };
    }
    const order = placed.order;
    stagedRef.current = null;
    setStagedTrade(null);
    actionsRef.current.onOrderPlaced?.(order);
    actionsRef.current.showToast?.(`⚡ Paper ${order.side.toUpperCase()} ${order.qty} ${order.sym} @ ${order.type === "market" ? "MKT" : order.price.toFixed(2)}`, "ok");
    return { ok: true, order };
  }, []);

  const clearStaged = useCallback(() => { stagedRef.current = null; setStagedTrade(null); }, []);

  // ── execute the model's JSON actions ───────────────────────────────────
  // Returns any data produced by lookup actions, which triggers one follow-up
  // model turn so it can answer with real numbers.
  const executeActions = useCallback(async (list: BrainAction[], isFollowUp = false): Promise<{ tool: string; result: unknown }[]> => {
    // The follow-up turn exists only to SPEAK the looked-up answer. Free models
    // often re-emit their previous action list alongside it, which would fire
    // every side effect twice (duplicate alerts, double undo, double seek).
    // Dropping actions here makes that structurally impossible.
    if (isFollowUp) return [];
    const A = actionsRef.current;
    const snap = snapRef.current();
    const spot = snap.bars.length ? snap.bars[snap.bars.length - 1].c : (snap.meta?.regularMarketPrice ?? 0);
    const dataResults: { tool: string; result: unknown }[] = [];
    for (const { tool, args } of list) {
      try {
        // everything except the paper-trade actions is handled centrally
        const shared = await dispatchSimpleAction(tool, args, A);
        if (shared.handled) {
          if (shared.data !== undefined) dataResults.push({ tool, result: shared.data });
          // Never let a dropped action pass silently — the model has already
          // queued speech claiming it worked.
          if (shared.failed) {
            A.showToast?.(`⚠️ Couldn't do "${tool}" — ${shared.note ?? "bad arguments"}`, "warn");
            historyRef.current.push({
              role: "system",
              content: `NOTE: the action "${tool}" FAILED (${shared.note ?? "bad arguments"}) and was NOT applied. Tell the user it didn't work instead of claiming success.`,
            });
          }
          continue;
        }
        switch (tool) {
          case "stage_paper_trade": {
            const side = args.side === "sell" ? "sell" : "buy";
            const qty = Number(args.quantity);
            const orderType = args.order_type === "market" ? "market" : "limit";
            const limitPrice = args.limit_price != null ? Number(args.limit_price) : null;
            if (!Number.isFinite(qty) || qty <= 0) break;
            if (orderType === "limit" && (limitPrice == null || !Number.isFinite(limitPrice))) break;
            const estPrice = orderType === "market" ? spot : (limitPrice as number);
            const staged: StagedTrade = {
              side, qty, orderType, limitPrice, sym: snap.symbol, estPrice, estValue: estPrice * qty,
              summary: `${side.toUpperCase()} ${qty} ${snap.symbol} ${orderType}${orderType === "limit" ? ` @ $${estPrice.toFixed(2)}` : " @ market"}`,
            };
            stagedRef.current = staged;
            affirmedSinceStageRef.current = false; // reset the code-level gate on every stage
            stagedAtRef.current = Date.now();
            setStagedTrade(staged);
            break;
          }
          case "confirm_paper_trade": {
            // Code-enforced gate. A blocked confirm must NOT be silent — the model
            // has already queued speech that may claim the order was placed, so we
            // correct the user AND tell the model in history.
            if (!stagedRef.current) {
              actionsRef.current.showToast?.("⚠️ Nothing staged — no order placed", "warn");
              historyRef.current.push({ role: "system", content: "NOTE: confirm_paper_trade was BLOCKED — nothing is staged. Do not tell the user an order was placed." });
              break;
            }
            if (!affirmedSinceStageRef.current) {
              actionsRef.current.showToast?.("⚠️ Not placed — say “yes” to confirm the order", "warn");
              historyRef.current.push({ role: "system", content: "NOTE: confirm_paper_trade was BLOCKED — the user has NOT said yes since the order was staged. Ask them to confirm out loud. Do not claim it was placed." });
              break;
            }
            if (Date.now() - stagedAtRef.current >= STAGED_TTL_MS) {
              clearStaged();
              actionsRef.current.showToast?.("⚠️ Staged order expired — re-stage it", "warn");
              historyRef.current.push({ role: "system", content: "NOTE: the staged order EXPIRED and was cleared. Tell the user, and re-stage only if they still want it. Do not claim it was placed." });
              break;
            }
            placeStaged();
            break;
          }
          case "cancel_staged_trade": clearStaged(); break;
          default: break;
        }
      } catch { /* one bad action shouldn't kill the turn */ }
    }
    return dataResults;
  }, [placeStaged, clearStaged]);

  const resumeListening = useCallback(() => {
    if (!mutedRef.current && statusRef.current === "live") {
      recognizerRef.current?.setEnabled(true);
      setListening(true);
    }
  }, []);

  // Single place that ends a speaking turn and hands the mic back. Idempotent.
  const finishSpeaking = useCallback(() => {
    if (speechPollRef.current) { clearInterval(speechPollRef.current); speechPollRef.current = null; }
    if (speechFailsafeRef.current) { clearTimeout(speechFailsafeRef.current); speechFailsafeRef.current = null; }
    setSpeaking(false);
    lastSpeechEndAtRef.current = Date.now();
    setTimeout(resumeListening, ECHO_COOLDOWN_MS); // wait out our own audio tail
  }, [resumeListening]);

  // ── speak a reply (pauses the recognizer during + just after TTS to avoid echo) ──
  const speakReply = useCallback((text: string, isGreeting = false) => {
    if (statusRef.current !== "live") return; // session ended — don't talk over the exit
    lastAssistantRef.current = text;
    recognizerRef.current?.setEnabled(false);
    setListening(false);
    const rate = (PERSONAS[personaRef.current] ?? PERSONAS[DEFAULT_PERSONA]).ttsRate;
    let started = false;

    // If TTS never even starts (silently blocked/queued), recover fast.
    const startGuard = setTimeout(() => {
      if (started) return;
      if (isGreeting) setNeedsTap(true);
      finishSpeaking();
    }, 1800);

    // Hard failsafe: the mic must NEVER stay disabled indefinitely, whatever the
    // browser does with our utterance.
    if (speechFailsafeRef.current) clearTimeout(speechFailsafeRef.current);
    speechFailsafeRef.current = setTimeout(() => finishSpeaking(), 25_000);

    speak(text, {
      voice: voiceRef.current,
      rate,
      onStart: () => { started = true; clearTimeout(startGuard); setNeedsTap(false); setSpeaking(true); },
      onEnd: () => { clearTimeout(startGuard); finishSpeaking(); },
    });

    // Poll speechSynthesis as the source of truth — Chrome frequently never
    // fires `onend`, which used to strand the mic in the disabled state.
    if (speechPollRef.current) clearInterval(speechPollRef.current);
    speechPollRef.current = setInterval(() => {
      if (started && !ttsIsSpeaking()) finishSpeaking();
    }, 250);
  }, [finishSpeaking]);

  // ── one conversational turn ────────────────────────────────────────────
  const runTurn = useCallback(async (opts: { userText?: string; directive?: string; isGreeting?: boolean; isFollowUp?: boolean }) => {
    if (busyRef.current && !opts.isFollowUp) return; // follow-ups continue the same turn
    busyRef.current = true;
    const myGen = genRef.current; // this turn belongs to the current connection only
    const controller = new AbortController();
    abortRef.current = controller;
    recognizerRef.current?.setEnabled(false); // don't transcribe ourselves while thinking/speaking
    cancelSpeech();
    setSpeaking(false);
    // true only if this turn is still the active connection's live turn
    const stale = () => !mountedRef.current || myGen !== genRef.current || statusRef.current !== "live";
    try {
      if (opts.userText) historyRef.current.push({ role: "user", content: opts.userText });
      const snap = snapRef.current();
      const analysis = computeAnalysis(snap.bars, snap.meta, snap.symbol, snap.name, snap.timeframe);
      const messages: ChatMsg[] = [
        { role: "system", content: systemPromptRef.current },
        buildSnapshotContext(analysis),
        buildWorkspaceContext(actionsRef.current.getWorkspaceState()),
        ...(opts.directive ? [{ role: "system" as const, content: opts.directive }] : []),
        ...historyRef.current.slice(-MAX_HISTORY),
      ];
      const r = await fetch("/api/voice/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }), signal: controller.signal });
      const j = await r.json();
      if (stale()) return; // session was ended / reset / persona-swapped mid-flight — drop everything
      if (!r.ok || !j.ok) {
        const em = j?.error || "voice brain error";
        setError(em);
        actionsRef.current.showToast?.(em, "warn");
        resumeListening();
        return;
      }
      const reply = parseBrainReply(j.content);
      historyRef.current.push({ role: "assistant", content: reply.speech || "(action taken)" });
      if (reply.speech) setFinal(`a-${Date.now()}`, "assistant", reply.speech);
      const dataResults = await executeActions(reply.actions, !!opts.isFollowUp);
      if (stale()) return;

      // A lookup action returned data — do ONE follow-up turn so the model can
      // answer with the real numbers instead of guessing. (We deliberately don't
      // speak the interim "let me check" line; the answer follows in ~2s.)
      if (dataResults.length && !opts.isFollowUp) {
        busyRef.current = false; // let the follow-up through the busy guard
        await runTurnRef.current?.({
          directive:
            `LOOKUP RESULTS from the action(s) you just called: ${JSON.stringify(dataResults)}. ` +
            `Answer the user now using ONLY these numbers, in "speech". Emit an EMPTY "actions" array — ` +
            `everything you asked for has already been done. Do NOT call lookup_symbol or search_symbols again.`,
          isFollowUp: true,
          isGreeting: opts.isGreeting, // keep the tap-to-hear recovery on a greeting turn
        });
        return;
      }

      if (reply.speech) speakReply(reply.speech, opts.isGreeting);
      else if (opts.isFollowUp) {
        // We fetched the data but the model returned no words — never leave the
        // user in silence after they asked a question.
        speakReply("I pulled that up but couldn't put it into words — ask me again?", opts.isGreeting);
      } else resumeListening();
    } catch (e) {
      if ((e as Error).name === "AbortError" || stale()) return; // deliberately cancelled
      setError((e as Error).message || "voice turn failed");
      resumeListening();
    } finally {
      busyRef.current = false;
    }
  }, [executeActions, speakReply, setFinal, resumeListening]);

  // lets runTurn re-enter itself for the lookup follow-up without a circular dep
  const runTurnRef = useRef<typeof runTurn | null>(null);
  runTurnRef.current = runTurn;

  // recognizer callback for a completed user utterance
  const onUserFinal = useCallback((text: string) => {
    setInterim("");
    if (statusRef.current !== "live" || mutedRef.current || busyRef.current) return;
    // Only suspect self-echo right after we stopped talking — outside that window
    // everything the mic hears is genuinely the user.
    if (Date.now() - lastSpeechEndAtRef.current < ECHO_WINDOW_MS && isEcho(text, lastAssistantRef.current)) return;
    affirmedSinceStageRef.current = isAffirmative(text); // arm the trade gate only on a real "yes"
    setFinal(`u-${Date.now()}`, "user", text);
    runTurn({ userText: text });
  }, [runTurn, setFinal]);

  const teardown = useCallback(() => {
    genRef.current++;                     // invalidate any in-flight turn
    try { abortRef.current?.abort(); } catch {}
    abortRef.current = null;
    if (speechPollRef.current) { clearInterval(speechPollRef.current); speechPollRef.current = null; }
    if (speechFailsafeRef.current) { clearTimeout(speechFailsafeRef.current); speechFailsafeRef.current = null; }
    try { recognizerRef.current?.destroy(); } catch {}
    cancelSpeech();
    recognizerRef.current = null;
    busyRef.current = false;
    stagedRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  // ── connect ────────────────────────────────────────────────────────────
  const connect = useCallback(async (personaOverride?: PersonaId) => {
    if (statusRef.current === "connecting" || statusRef.current === "live") return;
    const p: PersonaId = personaOverride ?? personaRef.current ?? DEFAULT_PERSONA;
    setStat("connecting");
    setError(null);
    setNeedsTap(false);

    if (!ttsSupported()) { setError("this browser can't do speech — try Chrome"); setStat("error"); return; }
    await loadVoices();
    if (!mountedRef.current) return;
    voiceRef.current = pickVoice((PERSONAS[p] ?? PERSONAS[DEFAULT_PERSONA]).ttsHints);
    systemPromptRef.current = buildSystemPrompt(p);
    historyRef.current = [];

    // set up the mic recognizer (null in browsers without SpeechRecognition —
    // we still run in text-only mode there).
    const rec = createRecognizer({
      onInterim: (t) => { if (!mutedRef.current) setInterim(t); }, // live proof the mic is hearing you
      onFinal: onUserFinal,
      onError: (e) => {
        // Never swallow a recognition error — a silent mic with no explanation
        // is the worst failure mode. None of these are fatal: the co-pilot still
        // talks and takes typed input.
        const msg =
          e === "not-allowed" || e === "service-not-allowed"
            ? "Mic blocked — click the 🔒 in Chrome's address bar → Microphone → Allow, then reload"
            : e === "audio-capture" ? "No microphone found — check your input device in system settings"
            : e === "network" ? "Speech service unreachable — Chrome sends audio to Google to transcribe, so it needs internet"
            : e === "language-not-supported" ? "Speech language not supported by this browser"
            : e === "recognition-stuck" ? "Mic recognition stalled — toggle the mic button to restart it"
            : `Mic error: ${e}`;
        setMicError(msg);
        actionsRef.current.showToast?.(`🎙 ${msg}`, "warn");
      },
    });
    recognizerRef.current = rec;
    if (!rec && !sttSupported()) {
      actionsRef.current.showToast?.("🎙 No mic support in this browser — type to the co-pilot instead", "warn");
    }
    rec?.start();
    setStat("live");

    // greet immediately with the real snapshot
    runTurn({
      directive: "The user just opened their workspace. Greet them in character in ONE short sentence, then give a two-sentence read of the live snapshot. Keep it under ~45 words.",
      isGreeting: true,
    });
  }, [setStat, onUserFinal, runTurn, teardown]);

  const disconnect = useCallback(() => {
    teardown();
    setStat("idle");
    setSpeaking(false);
    setStagedTrade(null);
    setNeedsTap(false);
  }, [teardown, setStat]);

  const reconnect = useCallback(async (personaOverride?: PersonaId) => {
    teardown();
    setStat("idle");
    setSpeaking(false);
    setTranscript([]);
    await new Promise((r) => setTimeout(r, 150));
    connect(personaOverride);
  }, [teardown, setStat, connect]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (next) {
        recognizerRef.current?.setEnabled(false);
        cancelSpeech();
        setSpeaking(false);
        setListening(false);
        setInterim("");
      } else if (statusRef.current === "live" && !busyRef.current) {
        recognizerRef.current?.setEnabled(true);
        setListening(true);
      }
      return next;
    });
  }, []);

  const tapToHear = useCallback(() => {
    setNeedsTap(false);
    if (lastAssistantRef.current) speakReply(lastAssistantRef.current);
  }, [speakReply]);

  const confirmStagedFromUI = useCallback(() => {
    const r = placeStaged();
    if (r.ok) {
      historyRef.current.push({ role: "user", content: "(I confirmed the order with the button.)" });
      historyRef.current.push({ role: "assistant", content: "Order placed." });
      speakReply("Done — order's in.");
    }
  }, [placeStaged, speakReply]);

  const cancelStagedFromUI = useCallback(() => {
    clearStaged();
    historyRef.current.push({ role: "user", content: "(I cancelled the staged order.)" });
    speakReply("Cancelled — no order placed.");
  }, [clearStaged, speakReply]);

  const sendText = useCallback((text: string) => {
    const t = text.trim();
    if (!t || statusRef.current !== "live" || busyRef.current) return; // drop while a turn is in flight
    affirmedSinceStageRef.current = isAffirmative(t);
    setFinal(`u-${Date.now()}`, "user", t);
    runTurn({ userText: t });
  }, [runTurn, setFinal]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; teardown(); };
  }, [teardown]);

  return {
    status, error, muted, needsTap, speaking, transcript, stagedTrade, interim, listening, micError,
    connect, disconnect, reconnect, toggleMute, tapToHear, sendText,
    confirmStagedFromUI, cancelStagedFromUI,
  };
}
