// Fire-and-forget product events. Everything a user does that's worth knowing
// later funnels through track() into /api/events — batched, debounced, flushed
// on tab close, never blocking the UI and never throwing.
//
// Safe to import anywhere (stores included): every entry point no-ops outside
// the browser, and a failed send drops the batch silently — analytics must
// never break trading.

type Props = Record<string, string | number | boolean | null>;
type Ev = { type: string; ts: number; page: string; props?: Props };

const DEVICE_KEY = "lb-device";
const FLUSH_MS = 4000;
const MAX_BATCH = 50;

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

function send(events: Ev[], useBeacon: boolean) {
  if (!events.length) return;
  const body = JSON.stringify({ device: deviceId(), events });
  try {
    if (useBeacon && navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* dropped — analytics never breaks the app */
  }
}

export function flushEvents(useBeacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue;
  queue = [];
  send(batch, useBeacon);
}

export function track(type: string, props?: Props) {
  if (typeof window === "undefined") return;
  if (!wired) {
    wired = true;
    window.addEventListener("pagehide", () => flushEvents(true));
  }
  queue.push({ type, ts: Date.now(), page: window.location.pathname, ...(props ? { props } : {}) });
  if (queue.length >= MAX_BATCH) {
    flushEvents();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      flushEvents();
    }, FLUSH_MS);
  }
}
