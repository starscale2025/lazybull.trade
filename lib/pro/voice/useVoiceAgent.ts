"use client";

// The client engine for the LazyBull voice co-pilot.
// Opens a WebRTC session to the OpenAI Realtime API (GA), streams mic audio up,
// plays the model's voice down, keeps a live transcript, and routes the model's
// tool calls to the Pro-charts actions passed in from the page.
//
// Nothing here touches the rest of the site — it's driven entirely by the
// `actions` + `getSnapshot` the /pro page hands us.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bar } from "@/components/pro/chartCore";
import { computeAnalysis, type QuoteMeta, type MarketAnalysis } from "./analysis";
import { buildInstructions, PERSONAS, DEFAULT_PERSONA, type PersonaId } from "./personality";
import { VOICE_TOOLS } from "./tools";
import { dispatchSimpleAction } from "./actionDispatch";
import { isAffirmative, STAGED_TTL_MS } from "./confirm";

export type VoiceSnapshot = {
  symbol: string;
  name: string;
  exch: string;
  timeframe: string;
  bars: Bar[];
  meta: QuoteMeta;
  indicators: string[];
};

export type PlacedOrder = { id: string; side: "buy" | "sell"; type: "market" | "limit"; qty: number; price: number; sym: string; ts: number };

export type StagedTrade = {
  side: "buy" | "sell";
  qty: number;
  orderType: "market" | "limit";
  limitPrice: number | null;
  sym: string;
  estPrice: number;
  estValue: number;
  summary: string;
};

// A compact read-back of everything the workspace currently shows. Injected into
// the model's context each turn so it can answer "what alerts do I have?" /
// "what's on my chart?" without a data round-trip.
export type WorkspaceState = {
  symbol: string;
  timeframe: string;
  chartType: string;
  layout: number;
  rangePreset: string;
  tool: string;
  color: string;
  indicators: string[];
  drawingCount: number;
  alerts: { price: number; cond: string; note?: string; triggered?: boolean }[];
  orders: { side: string; qty: number; sym: string; price: number; type: string }[];
  watchlist: string[];
  replay: { active: boolean; playing: boolean; speed: number; cursor: number; total: number };
};

export type VoiceActions = {
  // ── chart ──
  setSymbolByTicker: (ticker: string) => Promise<{ ok: boolean; symbol?: string; name?: string; error?: string }>;
  setTimeframe: (tf: string) => void;
  setChartType: (c: string) => void;
  setLayout: (n: number) => void;
  setRangePreset: (preset: string) => void;
  zoomTo: (bars: number) => void;
  toggleFullscreen: () => void;
  snapshot: () => void;
  saveWorkspace: () => void;
  // ── indicators ──
  addIndicator: (id: string) => void;
  removeIndicator: (id: string) => void;
  clearIndicators: () => void;
  // ── drawing ──
  selectTool: (tool: string) => void;
  setColor: (color: string) => void;
  drawHorizontal: (price: number) => void;
  drawTrendline: (fromPrice: number, toPrice: number, fromBarsAgo?: number, toBarsAgo?: number) => void;
  drawFib: (fromPrice: number, toPrice: number) => void;
  drawRect: (fromPrice: number, toPrice: number, fromBarsAgo?: number, toBarsAgo?: number) => void;
  drawText: (price: number, text: string, barsAgo?: number) => void;
  clearDrawings: () => void;
  undo: () => void;
  redo: () => void;
  // ── alerts ──
  createAlert: (price: number, cond: "above" | "below", note?: string) => void;
  deleteAlert: (price: number) => boolean;
  clearAlerts: () => void;
  openAlerts: (open: boolean) => void;
  // ── replay ──
  startReplay: () => void;
  stopReplay: () => void;
  setReplayPlaying: (playing: boolean) => void;
  setReplaySpeed: (speed: number) => void;
  replaySeek: (opts: { to?: number; step?: number }) => void;
  // ── trading ──
  openTradePanel: (open: boolean) => void;
  // ── watchlist ──
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  // ── data lookups (return values → may trigger a follow-up model turn) ──
  lookupSymbol: (ticker: string) => Promise<Record<string, unknown>>;
  searchSymbols: (query: string) => Promise<Record<string, unknown>>;
  // ── state read-back ──
  getWorkspaceState: () => WorkspaceState;
  // ── plumbing ──
  onOrderPlaced?: (order: PlacedOrder) => void;
  showToast?: (text: string, tone?: "ok" | "warn") => void;
};

export type VoiceStatus = "idle" | "connecting" | "live" | "error";

export type TranscriptEntry = { id: string; role: "user" | "assistant"; text: string; ts: number };

type Args = {
  getSnapshot: () => VoiceSnapshot;
  actions: VoiceActions;
  persona: PersonaId;
};

const ORDERS_KEY = "lb-pro-orders";

export function useVoiceAgent({ getSnapshot, actions, persona }: Args) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [stagedTrade, setStagedTrade] = useState<StagedTrade | null>(null);
  const [speaking, setSpeaking] = useState(false);

  // imperative session refs (never trigger re-render)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stagedRef = useRef<StagedTrade | null>(null);
  // Code-enforced trade gate: a staged trade can only be confirmed after the
  // user AFFIRMATIVELY said yes ("do it"/"confirm") since staging, and before the
  // stage goes stale. Armed only by an affirmative user turn.
  const affirmedSinceStageRef = useRef(false);
  const stagedAtRef = useRef(0);
  // when the user's current utterance STARTED — transcription arrives async, so
  // without this the very utterance that asked for the trade could arm the gate
  // after staging and self-confirm.
  const speechStartedAtRef = useRef(0);
  const responsePendingRef = useRef(false);
  const wantResponseRef = useRef(false);
  const statusRef = useRef<VoiceStatus>("idle");
  const mutedRef = useRef(false);
  const mountedRef = useRef(true); // false once the component unmounts (abort guard)

  // latest actions/persona/getSnapshot without re-binding the socket
  const actionsRef = useRef(actions);
  const snapRef = useRef(getSnapshot);
  const personaRef = useRef<PersonaId>(persona);
  useEffect(() => { actionsRef.current = actions; }, [actions]);
  useEffect(() => { snapRef.current = getSnapshot; }, [getSnapshot]);
  useEffect(() => { personaRef.current = persona; }, [persona]);

  const setStat = useCallback((s: VoiceStatus) => { statusRef.current = s; setStatus(s); }, []);

  const send = useCallback((obj: unknown) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(obj));
  }, []);

  // Serialize response.create so we never hit "conversation already has an active response".
  const requestResponse = useCallback((response?: Record<string, unknown>) => {
    if (responsePendingRef.current) { wantResponseRef.current = true; return; }
    responsePendingRef.current = true;
    send({ type: "response.create", ...(response ? { response } : {}) });
  }, [send]);

  // ── transcript helpers ────────────────────────────────────────────────
  const pushDelta = useCallback((id: string, role: "user" | "assistant", delta: string) => {
    if (!delta) return;
    setTranscript((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return [...prev, { id, role, text: delta, ts: Date.now() }].slice(-24);
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], text: copy[idx].text + delta };
      return copy;
    });
  }, []);
  const setFinal = useCallback((id: string, role: "user" | "assistant", text: string) => {
    if (!text) return;
    setTranscript((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return [...prev, { id, role, text, ts: Date.now() }].slice(-24);
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], text };
      return copy;
    });
  }, []);

  // ── paper-trade placement (same ledger shape TradeDrawer uses) ─────────
  const placeStaged = useCallback((): { ok: boolean; order?: PlacedOrder; error?: string } => {
    const st = stagedRef.current;
    if (!st) return { ok: false, error: "no staged trade to confirm" };
    const order: PlacedOrder = {
      id: `o-${Date.now()}`,
      side: st.side, type: st.orderType, qty: st.qty, price: st.estPrice, sym: st.sym, ts: Date.now(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]") as PlacedOrder[];
      localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...existing].slice(0, 30)));
      window.dispatchEvent(new CustomEvent("lb-orders-changed"));
    } catch { /* localStorage unavailable — order still reported to UI */ }
    stagedRef.current = null;
    setStagedTrade(null);
    actionsRef.current.onOrderPlaced?.(order);
    actionsRef.current.showToast?.(
      `⚡ Paper ${order.side.toUpperCase()} ${order.qty} ${order.sym} @ ${order.type === "market" ? "MKT" : order.price.toFixed(2)}`,
      "ok",
    );
    return { ok: true, order };
  }, []);

  const clearStaged = useCallback(() => { stagedRef.current = null; setStagedTrade(null); }, []);

  // ── tool dispatch ─────────────────────────────────────────────────────
  const runTool = useCallback(
    async (name: string, rawArgs: string): Promise<unknown> => {
      let args: Record<string, unknown> = {};
      try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch { /* tolerate empty/bad args */ }
      const A = actionsRef.current;
      const snap = snapRef.current();
      const spot = snap.bars.length ? snap.bars[snap.bars.length - 1].c : (snap.meta?.regularMarketPrice ?? 0);

      switch (name) {
        case "get_market_analysis": {
          const a: MarketAnalysis = computeAnalysis(snap.bars, snap.meta, snap.symbol, snap.name, snap.timeframe);
          return a;
        }
        case "get_workspace_state": return A.getWorkspaceState();
        case "stage_paper_trade": {
          const side = args.side === "sell" ? "sell" : "buy";
          const qty = Number(args.quantity);
          const orderType = args.order_type === "market" ? "market" : "limit";
          const limitPrice = args.limit_price != null ? Number(args.limit_price) : null;
          if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "quantity must be a positive number" };
          if (orderType === "limit" && (limitPrice == null || !Number.isFinite(limitPrice))) {
            return { ok: false, error: "limit orders need a limit_price" };
          }
          const estPrice = orderType === "market" ? spot : (limitPrice as number);
          const estValue = estPrice * qty;
          const summary = `${side.toUpperCase()} ${qty} ${snap.symbol} — ${orderType} order${orderType === "limit" ? ` at $${estPrice.toFixed(2)}` : " at market"} (~$${estValue.toFixed(2)}). Paper trade.`;
          const staged: StagedTrade = { side, qty, orderType, limitPrice, sym: snap.symbol, estPrice, estValue, summary };
          stagedRef.current = staged;
          affirmedSinceStageRef.current = false; // reset the gate on every fresh stage
          stagedAtRef.current = Date.now();
          setStagedTrade(staged);
          return { ok: true, staged: true, awaiting_confirmation: true, summary };
        }
        case "confirm_paper_trade": {
          if (!stagedRef.current) return { ok: false, error: "nothing staged — call stage_paper_trade first" };
          // Hard, code-level gate: the model may not self-confirm. The user must
          // have AFFIRMATIVELY said yes since staging, and the stage can't be stale.
          if (!affirmedSinceStageRef.current) {
            return { ok: false, error: "not yet confirmed by the user — read the order back and wait for the user to clearly say yes before confirming" };
          }
          if (Date.now() - stagedAtRef.current > STAGED_TTL_MS) {
            stagedRef.current = null;
            setStagedTrade(null);
            return { ok: false, error: "that staged order expired — re-stage it if the user still wants it" };
          }
          return placeStaged();
        }
        case "cancel_staged_trade": { clearStaged(); return { ok: true, cancelled: true }; }
        default: {
          // everything else (chart, indicators, drawing, alerts, replay,
          // watchlist, lookups) is handled by the shared dispatcher so both
          // engines expose exactly the same capabilities.
          const r = await dispatchSimpleAction(name, args, A);
          if (!r.handled) return { ok: false, error: `unknown tool ${name}` };
          if (r.data !== undefined) return { ok: true, data: r.data };
          return { ok: true, ...(r.note ? { note: r.note } : {}) };
        }
      }
    },
    [placeStaged, clearStaged],
  );

  // ── inbound event handler ─────────────────────────────────────────────
  const handleEvent = useCallback(
    async (msg: { type: string; [k: string]: unknown }) => {
      switch (msg.type) {
        case "response.created":
          responsePendingRef.current = true;
          setSpeaking(true);
          break;
        case "response.done":
          responsePendingRef.current = false;
          setSpeaking(false);
          if (wantResponseRef.current) { wantResponseRef.current = false; requestResponse(); }
          break;
        case "response.output_audio_transcript.delta":
          pushDelta(String(msg.item_id ?? "assistant"), "assistant", String(msg.delta ?? ""));
          break;
        case "response.output_audio_transcript.done":
          setFinal(String(msg.item_id ?? "assistant"), "assistant", String(msg.transcript ?? ""));
          break;
        case "conversation.item.input_audio_transcription.delta":
          pushDelta(String(msg.item_id ?? "user"), "user", String(msg.delta ?? ""));
          break;
        case "conversation.item.input_audio_transcription.completed": {
          const t = String(msg.transcript ?? "");
          setFinal(String(msg.item_id ?? "user"), "user", t);
          // arm only on a real "yes" that BEGAN after the order was staged
          affirmedSinceStageRef.current = isAffirmative(t) && speechStartedAtRef.current > stagedAtRef.current;
          break;
        }
        case "input_audio_buffer.speech_started":
          setSpeaking(false); // user barged in
          speechStartedAtRef.current = Date.now();
          break;
        case "response.function_call_arguments.done": {
          const callId = String(msg.call_id ?? "");
          const toolName = String(msg.name ?? "");
          let result: unknown;
          try { result = await runTool(toolName, String(msg.arguments ?? "{}")); }
          catch (e) { result = { ok: false, error: (e as Error).message }; }
          send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(result) } });
          requestResponse();
          break;
        }
        case "error": {
          const err = msg.error as { message?: string } | undefined;
          const m = err?.message || "realtime error";
          if (!/active response/i.test(m)) setError(m); // "active response" race is benign
          break;
        }
        default:
          break;
      }
    },
    [pushDelta, setFinal, runTool, send, requestResponse],
  );

  // ── teardown ──────────────────────────────────────────────────────────
  const teardown = useCallback(() => {
    try { dcRef.current?.close(); } catch {}
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    try { micRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.srcObject = null; } catch {} }
    dcRef.current = null; pcRef.current = null; micRef.current = null; audioRef.current = null;
    responsePendingRef.current = false; wantResponseRef.current = false; stagedRef.current = null;
  }, []);

  // ── connect ───────────────────────────────────────────────────────────
  const connect = useCallback(async (personaOverride?: PersonaId) => {
    if (statusRef.current === "connecting" || statusRef.current === "live") return;
    const p: PersonaId = personaOverride ?? personaRef.current ?? DEFAULT_PERSONA;
    const voice = (PERSONAS[p] ?? PERSONAS[DEFAULT_PERSONA]).voice;
    setStat("connecting");
    setError(null);
    setNeedsTap(false);

    try {
      // 1) mint ephemeral token server-side
      const tokRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice }),
      });
      const tok = await tokRes.json();
      if (!mountedRef.current) return; // unmounted during the token fetch — abort before we open anything
      if (!tokRes.ok || !tok?.value) throw new Error(tok?.error || "could not start voice session");

      // 2) peer connection + remote audio sink
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
        audioEl.play().catch(() => setNeedsTap(true));
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        // handle drops during BOTH 'connecting' (e.g. ICE fails before the data
        // channel opens) and 'live' — anything but a clean idle teardown.
        if ((s === "failed" || s === "disconnected" || s === "closed") && statusRef.current !== "idle") {
          setError(statusRef.current === "connecting" ? "couldn't connect (network/ICE)" : "voice connection dropped");
          setStat("idle");
          teardown();
        }
      };

      // 3) mic uplink
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { mic.getTracks().forEach((t) => t.stop()); teardown(); return; } // unmounted mid-getUserMedia
      micRef.current = mic;
      mic.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));
      pc.addTrack(mic.getAudioTracks()[0], mic);

      // 4) data channel (MUST be named "oai-events")
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", (ev) => {
        try { handleEvent(JSON.parse(ev.data)); } catch { /* ignore non-JSON frames */ }
      });
      dc.addEventListener("open", () => {
        setStat("live");
        send({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: buildInstructions(p),
            output_modalities: ["audio"],
            audio: {
              input: {
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 600,
                  create_response: true,
                  interrupt_response: true,
                },
                transcription: { model: "gpt-4o-mini-transcribe" },
              },
              output: { voice },
            },
            tools: VOICE_TOOLS,
            tool_choice: "auto",
          },
        });
        // greet immediately using the *real* current market snapshot
        const snap = snapRef.current();
        const a = computeAnalysis(snap.bars, snap.meta, snap.symbol, snap.name, snap.timeframe);
        requestResponse({
          instructions:
            `The user just opened their workspace. Greet them in character in ONE short sentence, then give a two-sentence read using ONLY these real, current numbers — do not invent any others: "${a.brief}" Keep the whole greeting under ~45 words.`,
        });
      });

      // 5) SDP offer → OpenAI → answer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${tok.value}`, "Content-Type": "application/sdp" },
      });
      if (!sdpRes.ok) throw new Error(`handshake failed (${sdpRes.status})`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
      if (!mountedRef.current) { teardown(); return; } // unmounted during the SDP exchange
    } catch (e) {
      const m = (e as Error).message || "voice failed to start";
      setError(/permission|denied|notallowed/i.test(m) ? "microphone permission denied" : m);
      setStat("error");
      teardown();
    }
  }, [setStat, send, handleEvent, requestResponse, teardown]);

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
    // let the media stack tear down before re-offering
    await new Promise((r) => setTimeout(r, 250));
    connect(personaOverride);
  }, [teardown, setStat, connect]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const tapToHear = useCallback(() => {
    setNeedsTap(false);
    audioRef.current?.play().catch(() => setNeedsTap(true));
  }, []);

  // UI-driven confirm/cancel (keeps the model in sync)
  const confirmStagedFromUI = useCallback(() => {
    const r = placeStaged();
    if (r.ok) {
      send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "Confirmed — I placed that order with the button." }] } });
      requestResponse();
    }
  }, [placeStaged, send, requestResponse]);

  const cancelStagedFromUI = useCallback(() => {
    clearStaged();
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "Cancel that order — I don't want it." }] } });
    requestResponse();
  }, [clearStaged, send, requestResponse]);

  const sendText = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: t }] } });
    setFinal(`local-${Date.now()}`, "user", t);
    affirmedSinceStageRef.current = isAffirmative(t); // arm the gate only on a real "yes"
    requestResponse();
  }, [send, setFinal, requestResponse]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; teardown(); };
  }, [teardown]);

  return {
    status, error, muted, needsTap, speaking, transcript, stagedTrade,
    // interface parity with the free engine (Realtime streams user transcripts
    // straight into `transcript`, so there's no separate interim buffer here)
    interim: "",
    listening: status === "live" && !muted && !speaking,
    micError: null as string | null,
    connect, disconnect, reconnect, toggleMute, tapToHear, sendText,
    confirmStagedFromUI, cancelStagedFromUI,
  };
}
