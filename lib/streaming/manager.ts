// The browser-side StreamingManager — one singleton per tab. It owns the SSE
// transport lifecycle so components never poll: every component that wants live
// prices calls subscribe(symbols, cb); the manager keeps ONE EventSource open
// for the UNION of all subscribed symbols and fans changed quotes back out to
// only the subscribers that care, throttled to a sane render rate.
//
// Responsibilities (mirrors the spec's StreamingManager):
//   • EventSource lifecycle (open/close on the symbol union, debounced)
//   • reconnect with exponential backoff
//   • heartbeat / stale-connection detection
//   • subscriptions + fan-out
//   • render throttling (≤ ~10fps)
//   • automatic fallback to polling /api/quote-batch if SSE can't establish
//
// It is transport-only: all data/provenance still comes from the market-data
// layer via the SSE route. Swapping to a true upstream websocket later (a worker
// feeding the same events, or a browser crypto socket) needs no change here.

import type { Quote } from "@/lib/market-data/provider";

export type QuoteMap = Record<string, Quote>;
type Subscriber = { symbols: Set<string>; cb: (quotes: QuoteMap) => void };
export type StreamMode = "idle" | "connecting" | "streaming" | "polling";

const THROTTLE_MS = 100; // coalesce fan-out to ≤10fps
const STALE_MS = 12_000; // no message (incl. heartbeat) this long → force reconnect
const MAX_SSE_ATTEMPTS = 4; // then fall back to polling (and keep retrying SSE)
const POLL_MS = 5_000;
const SSE_RETRY_WHILE_POLLING_MS = 30_000;

// ── pure helpers (unit-tested) ────────────────────────────────────────────

/** Sorted union of all subscribers' symbols — the set the one EventSource carries. */
export function unionOf(subs: Iterable<Subscriber>): string[] {
  const u = new Set<string>();
  for (const s of subs) for (const sym of s.symbols) u.add(sym);
  return [...u].sort();
}

/** Exponential backoff with a cap (ms): 1s, 2s, 4s, 8s, … ≤ 15s. */
export function backoffDelay(attempt: number): number {
  return Math.min(15_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

/** Symbols whose last price changed vs a prior map (server sends only changed,
    but the manager double-checks so a polling fallback behaves identically). */
export function changedSymbols(prev: Map<string, number>, quotes: Quote[]): string[] {
  return quotes.filter((q) => prev.get(q.sym) !== q.last).map((q) => q.sym);
}

// ── the manager ────────────────────────────────────────────────────────────

class StreamingManager {
  private subs = new Set<Subscriber>();
  private latest = new Map<string, Quote>();
  private es: EventSource | null = null;
  private currentUnion = "";
  private mode: StreamMode = "idle";
  private attempts = 0;
  private lastMessageAt = 0;

  private debounce: ReturnType<typeof setTimeout> | null = null;
  private reconnectT: ReturnType<typeof setTimeout> | null = null;
  private staleT: ReturnType<typeof setInterval> | null = null;
  private pollT: ReturnType<typeof setInterval> | null = null;
  private sseRetryT: ReturnType<typeof setTimeout> | null = null;
  private flushScheduled = false;
  private changed = new Set<string>();

  /** Subscribe to live quotes for `symbols`. Returns an unsubscribe fn. */
  subscribe(symbols: string[], cb: (quotes: QuoteMap) => void): () => void {
    const sub: Subscriber = { symbols: new Set(symbols.map((s) => s.toUpperCase())), cb };
    this.subs.add(sub);
    // Hand the newcomer whatever we already hold, immediately.
    const snap = this.snapshotFor(sub);
    if (Object.keys(snap).length) cb(snap);
    this.reconcile();
    return () => {
      this.subs.delete(sub);
      this.reconcile();
    };
  }

  getMode(): StreamMode {
    return this.mode;
  }

  // Debounce union changes so rapid mount/unmount (route changes) don't thrash
  // the connection.
  private reconcile() {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.apply(), 250);
  }

  private apply() {
    const union = unionOf(this.subs);
    const key = union.join(",");
    if (!union.length) {
      this.teardown();
      this.mode = "idle";
      this.currentUnion = "";
      return;
    }
    if (key === this.currentUnion && (this.mode === "streaming" || this.mode === "connecting")) return;
    this.currentUnion = key;
    this.attempts = 0;
    this.connect(union);
  }

  private connect(union: string[]) {
    this.teardown();
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      this.startPolling(union);
      return;
    }
    this.mode = "connecting";
    this.lastMessageAt = Date.now();
    const es = new EventSource(`/api/stream/quotes?symbols=${encodeURIComponent(union.join(","))}`);
    this.es = es;

    es.addEventListener("hello", () => {
      this.mode = "streaming";
      this.attempts = 0;
      this.lastMessageAt = Date.now();
      this.stopPolling(); // SSE recovered — leave polling fallback
    });
    es.addEventListener("hb", () => {
      this.lastMessageAt = Date.now();
    });
    es.addEventListener("quotes", (e) => {
      this.lastMessageAt = Date.now();
      this.ingest((e as MessageEvent).data);
    });
    es.addEventListener("bye", () => {
      // Server closed its cycle deliberately → reconnect promptly, no backoff.
      es.close();
      this.scheduleReconnect(true);
    });
    es.onerror = () => {
      es.close();
      this.scheduleReconnect(false);
    };

    this.staleT = setInterval(() => {
      if (this.mode === "streaming" && Date.now() - this.lastMessageAt > STALE_MS) {
        this.es?.close();
        this.scheduleReconnect(false);
      }
    }, 5000);
  }

  private scheduleReconnect(prompt: boolean) {
    if (this.staleT) clearInterval(this.staleT);
    this.attempts += 1;
    const union = this.currentUnion.split(",").filter(Boolean);
    if (!union.length) return;
    if (this.attempts > MAX_SSE_ATTEMPTS) {
      this.startPolling(union); // give the UI a working feed, keep retrying SSE
      return;
    }
    const delay = prompt ? 400 : backoffDelay(this.attempts);
    if (this.reconnectT) clearTimeout(this.reconnectT);
    this.reconnectT = setTimeout(() => this.connect(union), delay);
  }

  // ── polling fallback ──────────────────────────────────────────────────
  private startPolling(union: string[]) {
    if (this.mode === "polling") return;
    this.mode = "polling";
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    const poll = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${encodeURIComponent(union.join(","))}`);
        const j = await r.json();
        if (j?.ok && Array.isArray(j.quotes)) this.ingestQuotes(j.quotes as Quote[]);
      } catch {
        /* keep last values on a transient error */
      }
    };
    void poll();
    if (this.pollT) clearInterval(this.pollT);
    this.pollT = setInterval(poll, POLL_MS);
    // Periodically try to climb back onto SSE.
    if (this.sseRetryT) clearTimeout(this.sseRetryT);
    this.sseRetryT = setTimeout(() => {
      this.attempts = 0;
      this.connect(union);
    }, SSE_RETRY_WHILE_POLLING_MS);
  }
  private stopPolling() {
    if (this.pollT) {
      clearInterval(this.pollT);
      this.pollT = null;
    }
    if (this.sseRetryT) {
      clearTimeout(this.sseRetryT);
      this.sseRetryT = null;
    }
  }

  // ── ingest + fan-out ──────────────────────────────────────────────────
  private ingest(raw: string) {
    try {
      const { quotes } = JSON.parse(raw) as { quotes: Quote[] };
      this.ingestQuotes(quotes);
    } catch {
      /* ignore a malformed frame */
    }
  }
  private ingestQuotes(quotes: Quote[]) {
    for (const q of quotes) {
      if (!q?.sym) continue;
      this.latest.set(q.sym, q);
      this.changed.add(q.sym);
    }
    this.scheduleFlush();
  }
  private scheduleFlush() {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => {
      this.flushScheduled = false;
      this.flush();
    }, THROTTLE_MS);
  }
  private flush() {
    if (!this.changed.size) return;
    const changed = this.changed;
    this.changed = new Set();
    for (const sub of this.subs) {
      const out: QuoteMap = {};
      for (const sym of sub.symbols) {
        if (changed.has(sym)) {
          const q = this.latest.get(sym);
          if (q) out[sym] = q;
        }
      }
      if (Object.keys(out).length) sub.cb(out);
    }
  }
  private snapshotFor(sub: Subscriber): QuoteMap {
    const out: QuoteMap = {};
    for (const sym of sub.symbols) {
      const q = this.latest.get(sym);
      if (q) out[sym] = q;
    }
    return out;
  }

  private teardown() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    if (this.staleT) clearInterval(this.staleT);
    if (this.reconnectT) clearTimeout(this.reconnectT);
    this.stopPolling();
  }
}

/** The single per-tab manager. */
export const streamingManager = new StreamingManager();
