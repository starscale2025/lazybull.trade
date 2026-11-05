// Fire-and-forget product events. Everything a user does that's worth knowing
// later funnels through track() into /api/events — batched, debounced, flushed
// on tab close, never blocking the UI and never throwing.
//
// Safe to import anywhere (stores included): every entry point no-ops outside
// the browser, and a failed send drops the batch silently — analytics must
// never break trading.
//
// ── CONSENT IS THE FIRST GATE ───────────────────────────────────────────────
// Nothing is QUEUED without an adult yes. The diligence memo: India's DPDP
// rules (full compliance 13 May 2027) ban behavioural monitoring of minors and
// require verifiable parental consent, and "an un-consented dataset is an
// un-sellable dataset". So the check sits at the TOP of track(), before the
// queue — not at the flush, not on the server. An event that was never queued
// cannot leak out of a beacon on pagehide, and a device that never consented
// never even builds a batch.
//
// Two bases, because there are two consents:
//   • "analytics" (the default) — product analytics. Needs `analytics: true`.
//   • "trace" — decision traces (drags, undos, re-asks: lib/confusion.ts).
//     Needs `analytics: true` OR `training: true`, because the training
//     toggle's own copy names re-asks as the thing it covers. A user who said
//     no to analytics and yes to training has consented to exactly this.
// A record written under an OLDER consent text counts as undecided until the
// gate re-asks (see consentIsCurrent) — a missing event is cheaper than an
// un-consented one.
//
// ── SCHEMA v2 ───────────────────────────────────────────────────────────────
// Every event carries `sv: 2`. The first page_view of a session carries the
// landing context — `ref` (referrer HOST only) and `utm_source`/`utm_medium`/
// `utm_campaign` — and every later event repeats it as `ft_*` (first touch),
// so a conversion three pages deep still names the channel that brought it.
// The server stamps `country` (lib/db/events.ts); the client never sends one.

import {
  analyticsAllowed,
  consentIsCurrent,
  readConsent,
  trainingAllowed,
  type ConsentRecord,
} from "./consent";

type Props = Record<string, string | number | boolean | null>;
type Ev = { type: string; ts: number; page: string; sv: number; props?: Props };

/** Which consent carries this event. See the header. */
export type TrackBasis = "analytics" | "trace";

const DEVICE_KEY = "lb-device";
const FT_KEY = "lb-ft";
const FLUSH_MS = 4000;
const MAX_BATCH = 50;

/** Mirrors EVENT_SCHEMA_VERSION in lib/db/events.ts. NOT imported from there:
    that module pulls in the mongodb driver, which must never reach a browser
    bundle. Two constants, one number, and this comment is the seam. */
const SCHEMA_VERSION = 2;

/**
 * Events that bypass the consent gate entirely.
 *
 * DELIBERATELY EMPTY. "Essential" means an event the product cannot legally or
 * functionally operate without, and the two candidates — the consent decision
 * itself and signup — are both recorded SERVER-side (app/api/consent/route.ts
 * logs `consent_given`; lib/auth.ts logs the sign-in), where they carry no
 * client identifier we did not already have. There is nothing left client-side
 * that qualifies, so nothing is listed. Adding a name here means asserting
 * that it is lawful to collect from a person who has said no — do not do it
 * casually, and never for anything behavioural.
 */
const ESSENTIAL_EVENTS = new Set<string>();

/** Referrer host cap. A host is short; the cap is a hostile-input bound. */
const MAX_REF = 100;
/** UTM value cap — campaign names are the long ones. */
const MAX_UTM = 64;

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

/**
 * The consent decision for one event, as a pure function of the record.
 * Exported so the rule can be tested without a browser, a queue or a network.
 */
export function eventAllowed(
  type: string,
  rec: ConsentRecord | null,
  basis: TrackBasis = "analytics"
): boolean {
  if (ESSENTIAL_EVENTS.has(type)) return true;
  // Stale consent text → treat as undecided. The gate is already re-asking.
  if (!consentIsCurrent(rec)) return false;
  // Both helpers require `adult`, so an under-18 record fails every basis.
  if (analyticsAllowed(rec)) return true;
  return basis === "trace" && trainingAllowed(rec);
}

/** Anonymous per-device id. Created lazily — never for a device that declined. */
export function deviceId(): string {
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

// ── first-touch attribution ─────────────────────────────────────────────────

type FirstTouch = {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

/**
 * Read the landing context off the CURRENT document.
 *
 * HOST ONLY, never the full referrer: a referring URL's path and query can
 * carry someone else's PII (search terms, session ids, an email in a
 * newsletter link), and none of that is a channel. The host is the channel.
 * A same-origin referrer is dropped for the same reason it is useless — an
 * internal hop is not an acquisition.
 */
function captureFirstTouch(): FirstTouch {
  const ft: FirstTouch = {};
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).host;
      if (host && host !== window.location.host) ft.ref = host.slice(0, MAX_REF);
    }
  } catch {
    /* an unparseable referrer is no referrer */
  }
  try {
    const q = new URLSearchParams(window.location.search);
    const src = q.get("utm_source");
    const med = q.get("utm_medium");
    const camp = q.get("utm_campaign");
    if (src) ft.utm_source = src.slice(0, MAX_UTM);
    if (med) ft.utm_medium = med.slice(0, MAX_UTM);
    if (camp) ft.utm_campaign = camp.slice(0, MAX_UTM);
  } catch {
    /* no search params, no attribution */
  }
  return ft;
}

function readFirstTouch(): FirstTouch | null {
  try {
    const raw = sessionStorage.getItem(FT_KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : null;
  } catch {
    return null;
  }
}

function persistFirstTouch(ft: FirstTouch): void {
  try {
    sessionStorage.setItem(FT_KEY, JSON.stringify(ft));
  } catch {
    /* private mode — attribution degrades to per-event, never breaks */
  }
}

/**
 * The attribution fields for one event.
 *
 * The FIRST page_view of a session captures and carries the raw landing
 * context; every later event repeats it prefixed `ft_`. Session-scoped
 * (sessionStorage) on purpose: "first touch" means first touch of this visit,
 * and a value that outlived the tab would attribute month-old campaigns to
 * today's direct traffic.
 *
 * Called only on the consented path — a session that never consents never
 * writes the key.
 */
function attributionFor(type: string): Props {
  const stored = readFirstTouch();
  if (type === "page_view" && !stored) {
    const ft = captureFirstTouch();
    persistFirstTouch(ft);
    return { ...ft };
  }
  if (!stored) return {};
  return {
    ...(stored.ref ? { ft_ref: stored.ref } : {}),
    ...(stored.utm_source ? { ft_source: stored.utm_source } : {}),
    ...(stored.utm_medium ? { ft_medium: stored.utm_medium } : {}),
    ...(stored.utm_campaign ? { ft_campaign: stored.utm_campaign } : {}),
  };
}

// ── the queue ───────────────────────────────────────────────────────────────

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

export function track(type: string, props?: Props, opts?: { basis?: TrackBasis }) {
  if (typeof window === "undefined") return;
  // THE GATE. Before the queue, before the device id, before storage.
  if (!eventAllowed(type, readConsent(), opts?.basis ?? "analytics")) return;
  if (!wired) {
    wired = true;
    window.addEventListener("pagehide", () => flushEvents(true));
  }
  // Attribution last so a caller cannot overwrite it with a same-named prop.
  const merged: Props = { ...(props ?? {}), ...attributionFor(type) };
  queue.push({
    type,
    ts: Date.now(),
    page: window.location.pathname,
    sv: SCHEMA_VERSION,
    ...(Object.keys(merged).length ? { props: merged } : {}),
  });
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
