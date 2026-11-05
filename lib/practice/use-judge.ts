"use client";

// The run state machine behind the console — what happens between pressing
// ▶ run (or submit) and a verdict, with nothing scripted in between:
//
//   idle → loading (first run: the Python runtime downloads) → running (the
//   worker executes the solver's code, one case at a time) → judging (the
//   outputs go to the server, which compares them with the expectations only
//   it holds) → verdict
//
// The worker is lib/practice/runner.ts (public/practice/pyodide-worker.js);
// the comparison rule is lib/practice/judge.ts; the judge of record is
// app/api/practice/[slug]/submit. Two honest degradations: when the server
// cannot be reached a ▶ run is judged on this device against the visible
// cases the page already carries (judgedBy "device", recorded false), and a
// submit — which needs the hidden inputs — reports the outage instead of
// guessing. TypeScript is not judged at all: `begin` refuses it, and the
// workspace keeps the buttons disabled with a note saying so.
//
// Every async step checks it still belongs to the latest run (`seq`) and to a
// mounted hook, so a stale worker result or a late fetch can never paint over
// a newer run. The log is the truth of what happened, line by line, in the
// order it happened.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseOutput, ClientProblem, Lang, LogLine, LogTone, RunMode, RunReport, Verdict } from "./types";
import { PYODIDE_VERSION, RunTimeoutError, getRunner } from "./runner";
import { judgeOutputs } from "./judge";
import { fetchHiddenCases, submitOutputs, type PlanNeed } from "./client";

export type JudgePhase = "idle" | "loading" | "running" | "judging" | "verdict";

export type Judge = {
  phase: JudgePhase;
  mode: RunMode;
  lang: Lang;
  report: RunReport | null;
  /** The console so far — grows as the runtime loads, cases land and the server answers. */
  log: LogLine[];
  /** Per-case outputs as the worker posts them, before the verdict. */
  live: CaseOutput[];
  /** Set when a submit hit the plan wall (402): the plan that opens it. */
  wall: PlanNeed | null;
  /** The judge holds the file: loading, running or judging. */
  locked: boolean;
  begin: (mode: RunMode, code: string, lang: Lang) => void;
  reset: () => void;
};

const GOT_PREVIEW = 80;

function verdictLine(verdict: Verdict, passed: number, total: number): string {
  if (verdict === "accepted") return `accepted · ${passed}/${total} cases`;
  if (verdict === "error") return "nothing judged — the file did not run";
  return `wrong answer · ${passed}/${total} cases`;
}

export function useJudge(problem: ClientProblem): Judge {
  const [phase, setPhase] = useState<JudgePhase>("idle");
  const [mode, setMode] = useState<RunMode>("run");
  const [lang, setLang] = useState<Lang>("python");
  const [report, setReport] = useState<RunReport | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [live, setLive] = useState<CaseOutput[]>([]);
  const [wall, setWall] = useState<PlanNeed | null>(null);
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    seq.current++;
    setPhase("idle");
    setReport(null);
    setLog([]);
    setLive([]);
    setWall(null);
  }, []);

  const begin = useCallback(
    (nextMode: RunMode, code: string, nextLang: Lang) => {
      if (nextLang !== "python") return;
      const id = ++seq.current;
      const fresh = () => alive.current && seq.current === id;
      const lines: LogLine[] = [];
      const say = (text: string, tone?: LogTone) => {
        lines.push(tone ? { text, tone } : { text });
        if (fresh()) setLog([...lines]);
      };
      const finish = (rep: RunReport) => {
        if (!fresh()) return;
        setReport(rep);
        setPhase("verdict");
      };
      const errorReport = (error: { title: string; detail: string }, judgedBy: "server" | "device", recorded: boolean): RunReport => ({
        mode: nextMode,
        verdict: "error",
        cases: [],
        passed: 0,
        total: 0,
        runtimeMs: 0,
        beats: null,
        judgedBy,
        recorded,
        error,
        log: lines,
      });

      const runner = getRunner();
      const warm = runner.warm;
      setMode(nextMode);
      setLang(nextLang);
      setReport(null);
      setLive([]);
      setWall(null);
      setLog([]);
      setPhase(warm ? "running" : "loading");

      const visible = problem.cases.length;
      say(nextMode === "submit" ? `submit · ${visible} visible + ${problem.hiddenCount} hidden cases` : `run · ${visible} visible cases`);
      if (!warm) say("loading the Python runtime · ~10 MB, cached by your browser after the first run", "info");

      void (async () => {
        let cases = problem.cases.map((c) => ({ id: c.id, input: c.input }));
        if (nextMode === "submit") {
          const hidden = await fetchHiddenCases(problem.id);
          if (!fresh()) return;
          if (!hidden.ok) {
            if (hidden.need) {
              say(`submitting this problem needs the ${hidden.need} plan`, "warn");
              setWall(hidden.need);
              setPhase("idle");
              return;
            }
            say(hidden.error, "err");
            finish(errorReport({ title: "JudgeUnreachable", detail: hidden.error }, "device", false));
            return;
          }
          cases = [...cases, ...hidden.cases];
          say(`${hidden.cases.length} hidden inputs received — their expected values stay on the server`, "info");
        }

        let out;
        try {
          out = await runner.run(code, problem.entry, cases, {
            onProgress: (p) => {
              if (!fresh()) return;
              if (p.kind === "loading") setPhase("loading");
              else if (p.kind === "ready") {
                setPhase("running");
                if (!warm) say(`python ready · pyodide ${PYODIDE_VERSION} · ${p.bootMs} ms`, "ok");
              } else if (p.kind === "case") {
                setLive((l) => [...l, p.result]);
                const r = p.result;
                const got = r.got.length > GOT_PREVIEW ? `${r.got.slice(0, GOT_PREVIEW)}…` : r.got;
                say(r.error ? `case ${r.id} · ${r.error}` : `case ${r.id} → ${got} · ${r.ms} ms`, r.error ? "err" : undefined);
              }
            },
          });
        } catch (e) {
          if (!fresh()) return;
          if (e instanceof RunTimeoutError && e.phase === "exec") {
            const err = { title: "TimeLimit", detail: `stopped after ${Math.round(e.ms / 1000)} s — a loop that never ends?` };
            say(`${err.title} · ${err.detail}`, "err");
            // A time limit is still an attempt: book it so the ledger says what happened.
            setPhase("judging");
            const booked = await submitOutputs(problem.id, { lang: "python", mode: nextMode, code, outputs: [], error: err });
            if (!fresh()) return;
            finish(errorReport(err, booked.ok ? "server" : "device", booked.ok ? booked.recorded : false));
            return;
          }
          const err =
            e instanceof RunTimeoutError
              ? { title: "RuntimeUnavailable", detail: e.message }
              : { title: "WorkerError", detail: e instanceof Error ? e.message : String(e) };
          say(`${err.title} · ${err.detail}`, "err");
          finish(errorReport(err, "device", false));
          return;
        }
        if (!fresh()) return;
        if (out.error) say(`${out.error.title} · ${out.error.detail}`, "err");
        if (out.truncated) say("stdout was capped at 10 KB", "warn");

        setPhase("judging");
        say(nextMode === "submit" ? "judging on the server · compared to 6 decimal places" : "judging · compared to 6 decimal places");
        const res = await submitOutputs(problem.id, {
          lang: "python",
          mode: nextMode,
          code,
          outputs: out.results,
          ...(out.error ? { error: out.error } : {}),
        });
        if (!fresh()) return;

        const stdio = { ...(out.stdout ? { stdout: out.stdout } : {}), ...(out.stderr ? { stderr: out.stderr } : {}) };

        if (res.ok) {
          const r = res.report;
          say(verdictLine(r.verdict, r.passed, r.total), r.verdict === "accepted" ? "ok" : "err");
          if (!res.recorded) say(`verdict not saved — ${res.recordError ?? "the database was unreachable"}`, "warn");
          finish({
            mode: nextMode,
            verdict: r.verdict,
            cases: r.cases,
            passed: r.passed,
            total: r.total,
            runtimeMs: r.runtimeMs,
            beats: r.beats ?? null,
            judgedBy: "server",
            recorded: res.recorded,
            ...(out.error ? { error: out.error } : {}),
            ...stdio,
            log: lines,
          });
          return;
        }
        if (res.need) {
          say(`submitting this problem needs the ${res.need} plan`, "warn");
          setWall(res.need);
          setPhase("idle");
          return;
        }
        if (nextMode === "run") {
          // The visible cases carry their expectations, so a run can be judged
          // here when the server is away. Never a submit: the hidden ones do not.
          say(`${res.error} — judged on this device against the visible cases`, "warn");
          const j = out.error
            ? { verdict: "error" as const, passed: 0, total: 0, runtimeMs: 0, cases: [] }
            : judgeOutputs(problem.cases, out.results, "run");
          say(verdictLine(j.verdict, j.passed, j.total), j.verdict === "accepted" ? "ok" : "err");
          finish({ mode: nextMode, ...j, beats: null, judgedBy: "device", recorded: false, ...(out.error ? { error: out.error } : {}), ...stdio, log: lines });
          return;
        }
        say(res.error, "err");
        finish(errorReport({ title: "JudgeUnreachable", detail: res.error }, "device", false));
      })();
    },
    [problem]
  );

  const locked = phase === "loading" || phase === "running" || phase === "judging";

  return { phase, mode, lang, report, log, live, wall, locked, begin, reset };
}
