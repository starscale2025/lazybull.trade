// ON-DEVICE inference — the free tier's "your machine does the heavy lifting".
//
// Runs the 1D-CNN sequence model in the browser via onnxruntime-web (WASM),
// zero server. It fetches the SAME daily OHLCV Yahoo bars the Python service
// uses (/api/quote?tf=D) and applies the SAME normalization as
// `ai quants/serve.py::sequence_pred` — last 60 bars, OHLC ÷ last close,
// volume ÷ mean volume, shape (1,60,5) — so the output matches the trained
// model to ~1e-6. The 44KB model is self-hosted; the ~13MB WASM loads from a
// CDN so it never bloats the repo, and any failure returns null (the bot then
// falls back to the snapshot, then the TS surrogate).

import type { InferenceSession } from "onnxruntime-web";

const ORT_VERSION = "1.27.0"; // keep in sync with package.json onnxruntime-web
const MODEL_URL = "/models/sequence_cnn.onnx?v=2"; // bump when the model changes (cache-bust)

type Ort = typeof import("onnxruntime-web");
let ortP: Promise<Ort> | null = null;
let sessionP: Promise<InferenceSession> | null = null;

async function getOrt(): Promise<Ort> {
  if (!ortP) {
    ortP = import("onnxruntime-web").then((ort) => {
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
      return ort;
    });
  }
  return ortP;
}

async function getSession(): Promise<InferenceSession> {
  if (!sessionP) sessionP = getOrt().then((ort) => ort.InferenceSession.create(MODEL_URL));
  return sessionP;
}

type QuoteBar = { o: number; h: number; l: number; c: number; v: number; t: number };

export type CnnResult = {
  expectedReturn: number;
  direction: "up" | "down";
  asOf: string;
};

/** Run the sequence CNN in the browser for a ticker; null if unavailable. */
export async function runSequenceCnn(ticker: string): Promise<CnnResult | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}&tf=D`);
    if (!r.ok) return null;
    const j = await r.json();
    const bars: QuoteBar[] = Array.isArray(j?.bars) ? j.bars : [];
    if (bars.length < 60) return null;

    const win = bars.slice(-60);
    const lastClose = win[win.length - 1].c;
    if (!lastClose) return null;
    const meanVol = win.reduce((s, b) => s + b.v, 0) / win.length + 1e-9;

    const data = new Float32Array(60 * 5);
    for (let i = 0; i < 60; i++) {
      const b = win[i];
      data[i * 5 + 0] = b.o / lastClose;
      data[i * 5 + 1] = b.h / lastClose;
      data[i * 5 + 2] = b.l / lastClose;
      data[i * 5 + 3] = b.c / lastClose;
      data[i * 5 + 4] = b.v / meanVol;
    }

    const ort = await getOrt();
    const session = await getSession();
    const tensor = new ort.Tensor("float32", data, [1, 60, 5]);
    const out = await session.run({ ohlcv: tensor });
    const pred = (out.ret.data as Float32Array)[0];
    const t = win[win.length - 1].t;
    return {
      expectedReturn: pred,
      direction: pred > 0 ? "up" : "down",
      asOf: t ? new Date(t).toISOString().slice(0, 10) : "",
    };
  } catch {
    return null;
  }
}
