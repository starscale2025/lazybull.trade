// ON-DEVICE inference — the free tier's "your machine does the heavy lifting".
//
// Small trained nets exported to self-contained ONNX run in the browser via
// onnxruntime-web (WASM), zero server. Each fetches the SAME daily OHLCV the
// Python service uses (/api/quote?tf=D) and applies the SAME normalization as
// `ai quants/serve.py` (last N bars, OHLC ÷ last close, volume ÷ mean volume,
// shape 1×N×5), so the output matches the trained model. Any failure returns
// null and the bot falls back to the snapshot, then the TS surrogate.
//
// The runtime is SELF-HOSTED (threat model R-09). It used to load from
// cdn.jsdelivr.net with no integrity check, which meant a third party could
// swap the code that runs on a user's machine AND forced both
// `script-src https://cdn.jsdelivr.net` and `connect-src` allowances into the
// CSP. Three choices make the local copy work and stay small:
//   • `onnxruntime-web/wasm`, not the bare package. The default entry is the
//     JSEP build (WebGPU/WebNN) and wants ort-wasm-simd-threaded.jsep.wasm —
//     26 MB, far too much to commit. The CPU build is 13 MB and these nets are
//     a 60-bar CNN and a 252-bar encoder; WASM runs them in milliseconds.
//   • wasmPaths as a FILE override, not a directory prefix. Given a prefix the
//     loader dynamically `import()`s ort-wasm-simd-threaded.mjs from it — that
//     import is the only reason script-src ever needed a CDN host. Given
//     `{ wasm }` it uses the Emscripten glue already inlined in the bundle and
//     fetches nothing but the binary.
//   • numThreads = 1. The multi-threaded path needs SharedArrayBuffer, i.e.
//     COOP/COEP cross-origin isolation app-wide, which would cut off the
//     same-origin cinema iframe and the OpenAI WebRTC handshake. Single-thread
//     is also what the browser falls back to anyway without isolation.
// public/ort/ort-wasm-simd-threaded.wasm is a verbatim copy of
// node_modules/onnxruntime-web/dist/ — re-copy it whenever the pinned
// onnxruntime-web version in package.json moves, or inference stops loading.

import type { InferenceSession } from "onnxruntime-web";

const ORT_WASM = "/ort/ort-wasm-simd-threaded.wasm";
const MODEL_VER = "2"; // bump to cache-bust the .onnx files when re-exported

type Ort = typeof import("onnxruntime-web/wasm");
let ortP: Promise<Ort> | null = null;
const sessions: Record<string, Promise<InferenceSession>> = {};

async function getOrt(): Promise<Ort> {
  if (!ortP) {
    ortP = import("onnxruntime-web/wasm").then((ort) => {
      ort.env.wasm.wasmPaths = { wasm: ORT_WASM };
      ort.env.wasm.numThreads = 1;
      return ort;
    });
  }
  return ortP;
}

async function getSession(url: string): Promise<InferenceSession> {
  if (!sessions[url]) sessions[url] = getOrt().then((ort) => ort.InferenceSession.create(url));
  return sessions[url];
}

type QuoteBar = { o: number; h: number; l: number; c: number; v: number; t: number };

export type NnResult = { expectedReturn: number; direction: "up" | "down"; asOf: string };

async function runOhlcvModel(model: string, lookback: number, ticker: string): Promise<NnResult | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}&tf=D`);
    if (!r.ok) return null;
    const j = await r.json();
    const bars: QuoteBar[] = Array.isArray(j?.bars) ? j.bars : [];
    if (bars.length < lookback) return null;

    const win = bars.slice(-lookback);
    const lastClose = win[win.length - 1].c;
    if (!lastClose) return null;
    const meanVol = win.reduce((s, b) => s + b.v, 0) / win.length + 1e-9;

    const data = new Float32Array(lookback * 5);
    for (let i = 0; i < lookback; i++) {
      const b = win[i];
      data[i * 5 + 0] = b.o / lastClose;
      data[i * 5 + 1] = b.h / lastClose;
      data[i * 5 + 2] = b.l / lastClose;
      data[i * 5 + 3] = b.c / lastClose;
      data[i * 5 + 4] = b.v / meanVol;
    }

    const ort = await getOrt();
    const session = await getSession(`/models/${model}.onnx?v=${MODEL_VER}`);
    const out = await session.run({ ohlcv: new ort.Tensor("float32", data, [1, lookback, 5]) });
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

/** 1D-CNN over the last 60 OHLCV bars → expected 20d return, in the browser. */
export const runSequenceCnn = (ticker: string) => runOhlcvModel("sequence_cnn", 60, ticker);

/** Transformer encoder over the last 252 OHLCV bars → expected 20d return. */
export const runTransformer = (ticker: string) => runOhlcvModel("transformer_seq", 252, ticker);
