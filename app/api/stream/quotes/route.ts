import { getProvider } from "@/lib/market-data";
import type { Quote } from "@/lib/market-data/provider";

// Server-Sent Events transport for live quotes. The browser opens ONE
// EventSource here (via the client StreamingManager) and prices PUSH — no
// per-component polling interval.
//
// Why this is the right shape for Vercel: there is no persistent singleton on
// serverless to hold a shared upstream websocket, and Alpaca's free tier allows
// only one WS connection total — so the "one upstream subscription per symbol"
// guarantee is provided NOT by a shared socket but by the market-data layer's
// existing cache + in-flight de-dup: N concurrent SSE streams asking for AAPL
// collapse to ~one upstream fetch per cache window. This route is a thin push
// pump over getProvider(); all business logic (chain, breakers, provenance)
// stays in lib/market-data. A true upstream websocket (via an always-on worker,
// or a browser crypto socket) can later feed the same shape without touching
// this contract.
//
// Events emitted:
//   event: hello   — { symbols, at }              on connect
//   event: quotes  — { quotes: Quote[], provenance }  id: <seq>   (only changed)
//   : heartbeat                                    every tick (stale detection)
//   event: bye     — { reason }                    at the cycle boundary (client reconnects)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel cap; we close a beat before and the client reconnects

const TICK_MS = 2000; // push cadence (bounded by the 3s quote cache upstream)
const CYCLE_MS = 55_000; // close cleanly before maxDuration; EventSource reconnects seamlessly
const HEARTBEAT_EVERY = 1; // ticks between `:` heartbeats (every tick here)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = [
    ...new Set(
      (searchParams.get("symbols") || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ].slice(0, 50);

  const enc = new TextEncoder();
  let closed = false;
  // Client disconnect → stop the loop promptly (frees the upstream poll).
  req.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (!closed) {
          try {
            controller.enqueue(enc.encode(chunk));
          } catch {
            closed = true; // controller closed under us (client gone)
          }
        }
      };
      const sendEvent = (event: string, data: unknown, id?: number) =>
        write(`${id != null ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // A real event (not a `:` comment) so the client's stale-detection can see
      // it — EventSource fires no JS handler for comment lines.
      const heartbeat = () => write(`event: hb\ndata: ${Date.now()}\n\n`);

      // Tell EventSource to wait this long before reconnecting after a close.
      write("retry: 3000\n\n");
      sendEvent("hello", { symbols, at: Date.now() });

      if (!symbols.length) {
        controller.close();
        return;
      }

      // Last price we sent per symbol → only push what actually changed.
      const lastSent = new Map<string, number>();
      let seq = 0;
      let tick = 0;
      const startedAt = Date.now();

      try {
        // Prime immediately so a fresh (re)connection repopulates without waiting.
        await pump(true);
        while (!closed && Date.now() - startedAt < CYCLE_MS) {
          await sleep(TICK_MS);
          if (closed) break;
          await pump(false);
        }
        sendEvent("bye", { reason: "cycle" });
      } catch (e) {
        sendEvent("error", { message: e instanceof Error ? e.message : String(e) });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }

      async function pump(initial: boolean) {
        const { quotes, provenance } = await getProvider().getQuotes(symbols);
        const changed: Quote[] = initial
          ? quotes
          : quotes.filter((q) => lastSent.get(q.sym) !== q.last);
        for (const q of quotes) lastSent.set(q.sym, q.last);
        if (changed.length) sendEvent("quotes", { quotes: changed, provenance }, ++seq);
        if (tick++ % HEARTBEAT_EVERY === 0) heartbeat();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering so events flush immediately
    },
  });
}
