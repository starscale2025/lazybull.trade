// The browser side of the judge: owns the Web Worker that runs Pyodide
// (public/practice/pyodide-worker.js), speaks its protocol, and enforces the
// one thing the worker cannot enforce on itself — a hard timeout. Python runs
// synchronously inside the worker, so an infinite loop is only ever stopped by
// terminate(); the runner does that, rejects the run, and lazily builds a new
// worker for the next one (Pyodide reloads from the browser cache).
//
// Nothing here is created at import time: the worker is spawned on the first
// run() call — the first ▶ run or submit — which is what keeps the ~15 MB
// runtime off every page that merely shows a problem. Client-only: the
// workspace imports it from a "use client" component.
//
// What comes back is exactly what the worker measured: the formatted return
// value per case and its wall time in ms. Nothing is compared here; the
// comparison rule lives in lib/practice/judge.ts and the judge of record is
// app/api/practice/[slug]/submit.

import type { CaseOutput } from "./types";

export const WORKER_URL = "/practice/pyodide-worker.js";
export const PYODIDE_VERSION = "0.28.3";
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

/** Wall-clock cap on executing the cases, once the runtime is up. Every
    reference solution finishes its nine cases in well under a second; the cap
    exists for the loop that never ends. */
export const EXEC_TIMEOUT_MS = 20_000;
/** Cap on downloading and starting the runtime the first time. */
export const BOOT_TIMEOUT_MS = 180_000;

export type RunProgress =
  | { kind: "loading" }
  | { kind: "ready"; bootMs: number }
  | { kind: "case"; result: CaseOutput };

export type WorkerResult = {
  results: CaseOutput[];
  stdout: string;
  stderr: string;
  truncated: boolean;
  error?: { title: string; detail: string };
};

export class RunTimeoutError extends Error {
  constructor(public readonly ms: number, public readonly phase: "boot" | "exec") {
    super(phase === "boot" ? `the Python runtime did not load within ${Math.round(ms / 1000)} s` : `stopped after ${Math.round(ms / 1000)} s`);
    this.name = "RunTimeoutError";
  }
}

type Pending = {
  id: number;
  results: CaseOutput[];
  resolve: (r: WorkerResult) => void;
  reject: (e: Error) => void;
  onProgress?: (p: RunProgress) => void;
  timer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
};

export class PyodideRunner {
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private seq = 0;

  /** True once a worker has booted the runtime — the next run skips the download. */
  get warm(): boolean {
    return this.worker !== null;
  }

  get busy(): boolean {
    return this.pending !== null;
  }

  /**
   * Runs `code`, calling `entry(**kwargs)` for every case, and resolves with
   * the worker's outputs. Rejects with RunTimeoutError when the cap trips (the
   * worker is gone by then) or with a plain Error when the worker itself dies.
   * One run at a time: a second call while one is in flight rejects.
   */
  run(
    code: string,
    entry: string,
    cases: { id: string; input: string }[],
    opts: { onProgress?: (p: RunProgress) => void; execTimeoutMs?: number } = {}
  ): Promise<WorkerResult> {
    if (this.pending) return Promise.reject(new Error("a run is already in progress"));
    const execTimeout = opts.execTimeoutMs ?? EXEC_TIMEOUT_MS;

    return new Promise<WorkerResult>((resolve, reject) => {
      const id = ++this.seq;
      const pending: Pending = {
        id,
        results: [],
        resolve,
        reject,
        onProgress: opts.onProgress,
        timer: null,
        startedAt: performance.now(),
      };
      this.pending = pending;

      let worker: Worker;
      try {
        worker = this.ensureWorker();
      } catch (e) {
        this.pending = null;
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }

      // Boot cap first; swapped for the exec cap the moment the runtime reports
      // ready, so a slow first download never counts against the solver's code.
      this.arm(pending, BOOT_TIMEOUT_MS, "boot");

      const onMessage = (e: MessageEvent) => {
        const msg = e.data as
          | { type: "status"; id: number; phase: "loading" | "ready" }
          | { type: "case"; id: number; result: CaseOutput }
          | { type: "result"; id: number; results: CaseOutput[]; stdout: string; stderr: string; truncated: boolean; error?: { title: string; detail: string } };
        if (!msg || msg.id !== id) return;
        if (msg.type === "status") {
          if (msg.phase === "loading") pending.onProgress?.({ kind: "loading" });
          if (msg.phase === "ready") {
            this.arm(pending, execTimeout, "exec");
            pending.onProgress?.({ kind: "ready", bootMs: Math.round(performance.now() - pending.startedAt) });
          }
          return;
        }
        if (msg.type === "case") {
          pending.results.push(msg.result);
          pending.onProgress?.({ kind: "case", result: msg.result });
          return;
        }
        if (msg.type === "result") {
          this.settle(pending, worker, onMessage, onError);
          resolve({
            results: msg.results,
            stdout: msg.stdout ?? "",
            stderr: msg.stderr ?? "",
            truncated: Boolean(msg.truncated),
            ...(msg.error ? { error: msg.error } : {}),
          });
        }
      };
      const onError = (ev: ErrorEvent) => {
        this.settle(pending, worker, onMessage, onError);
        this.dispose();
        reject(new Error(ev.message || "the judge's worker crashed"));
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ type: "run", id, code, entry, cases });
    });
  }

  /** Stops whatever is running and drops the worker. Safe to call any time. */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error("run cancelled"));
    }
  }

  private ensureWorker(): Worker {
    if (typeof Worker === "undefined") throw new Error("this browser has no Web Workers — the judge cannot run here");
    if (!this.worker) this.worker = new Worker(WORKER_URL);
    return this.worker;
  }

  private arm(pending: Pending, ms: number, phase: "boot" | "exec"): void {
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      if (this.pending !== pending) return;
      // terminate() is the only way to stop a synchronous Python loop; the
      // worker — and the runtime it loaded — goes with it.
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
      this.pending = null;
      pending.reject(new RunTimeoutError(ms, phase));
    }, ms);
  }

  private settle(pending: Pending, worker: Worker, onMessage: (e: MessageEvent) => void, onError: (e: ErrorEvent) => void): void {
    if (pending.timer) clearTimeout(pending.timer);
    pending.timer = null;
    worker.removeEventListener("message", onMessage);
    worker.removeEventListener("error", onError);
    if (this.pending === pending) this.pending = null;
  }
}

let shared: PyodideRunner | null = null;

/** The page's one runner — one worker, one runtime, however many problems
    the solver opens in this tab. */
export function getRunner(): PyodideRunner {
  if (!shared) shared = new PyodideRunner();
  return shared;
}
