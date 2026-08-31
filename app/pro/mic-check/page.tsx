"use client";

// Standalone microphone diagnostic for the voice co-pilot.
// Deliberately does NOT use the voice hook — it drives the raw Web Speech API so
// it isolates "does this browser/mic work at all" from "is the app logic wrong".
// Open at /pro/mic-check in a real browser (not an embedded webview).

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";

type Line = { t: string; name: string; detail?: string };

export default function MicCheckPage() {
  const [env, setEnv] = useState<Record<string, string>>({});
  const [permission, setPermission] = useState<string>("unknown");
  const [devices, setDevices] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [finals, setFinals] = useState<string[]>([]);
  const [level, setLevel] = useState(0);
  const [running, setRunning] = useState(false);
  const recRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const log = useCallback((name: string, detail?: string) => {
    setLines((p) => [...p, { t: new Date().toLocaleTimeString(), name, detail }].slice(-200));
  }, []);

  useEffect(() => {
    const w = window as any;
    // Precise browser identity. Chromium forks (Brave/Arc/Vivaldi/Chromium) ship
    // WITHOUT Google's speech API key, so Web Speech always fails with `network`
    // no matter how healthy the mic is. Only genuine Google Chrome (and Edge)
    // can reach the speech service.
    const uaData = (navigator as any).userAgentData;
    const brands: string[] = uaData?.brands?.map((b: any) => b.brand) ?? [];
    const brandStr = brands.length ? brands.join(", ") : "(not reported)";
    const isBrave = !!(navigator as any).brave;
    const looksGenuineChrome = brands.some((b) => /google chrome/i.test(b)) && !isBrave;
    const forkHit = isBrave ? "Brave"
      : brands.find((b) => /brave|arc|vivaldi|opera|edge/i.test(b))
      || (/\b(Brave|Arc|Vivaldi|OPR|Edg)\b/.test(navigator.userAgent) ? "a Chromium fork" : null);
    setEnv({
      "Browser brands": brandStr,
      "Genuine Google Chrome": looksGenuineChrome
        ? "yes ✅"
        : `NO ❌ ${forkHit ? `— looks like ${forkHit}` : ""} — Chromium forks can't use Google speech (always 'network' error)`,
      "User agent": navigator.userAgent.slice(0, 100),
      "Secure context": String(window.isSecureContext) + (window.isSecureContext ? " ✅" : " ❌ (needs https or localhost)"),
      "Origin": location.origin,
      "SpeechRecognition API": (w.SpeechRecognition || w.webkitSpeechRecognition) ? "present ✅" : "MISSING ❌ (Firefox has none)",
      "speechSynthesis API": "speechSynthesis" in window ? "present ✅" : "MISSING ❌",
      "mediaDevices API": navigator.mediaDevices ? "present ✅" : "MISSING ❌",
      "Online": navigator.onLine ? "yes ✅" : "NO ❌ (Chrome STT needs internet)",
    });
    if ((navigator as any).permissions?.query) {
      (navigator as any).permissions.query({ name: "microphone" as PermissionName })
        .then((s: any) => { setPermission(s.state); s.onchange = () => setPermission(s.state); })
        .catch(() => setPermission("unsupported"));
    }
    // Enumerate inputs up front — this works without permission (labels may be
    // blank) and is the decisive check for "does the OS expose a mic at all".
    navigator.mediaDevices?.enumerateDevices?.()
      .then((list) => {
        const ins = list.filter((d) => d.kind === "audioinput");
        setEnv((p) => ({
          ...p,
          "Audio input devices": ins.length === 0
            ? "NONE FOUND ❌ — the OS is not exposing any microphone"
            : `${ins.length} found ✅`,
        }));
        setDevices(ins.map((d, i) => d.label || `(input ${i + 1} — label hidden until permission)`));
      })
      .catch(() => {});
  }, []);

  // 1) Ask for mic + show a live input level meter (proves the OS/device works)
  const testMic = async () => {
    try {
      log("getUserMedia", "requesting…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log("getUserMedia", "GRANTED ✅");
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput").map((d) => d.label || "(unnamed input)"));
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(100, Math.round((peak / 128) * 200)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) {
      log("getUserMedia", `FAILED ❌ ${e?.name}: ${e?.message}`);
    }
  };

  // 2) Drive raw SpeechRecognition and log every single event
  const startRecognition = () => {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { log("SpeechRecognition", "NOT SUPPORTED ❌"); return; }
    if (recRef.current) { try { recRef.current.abort(); } catch {} }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onstart = () => { setRunning(true); log("onstart", "listening…"); };
    rec.onaudiostart = () => log("onaudiostart", "mic audio flowing");
    rec.onsoundstart = () => log("onsoundstart", "sound detected");
    rec.onspeechstart = () => log("onspeechstart", "SPEECH detected ✅");
    rec.onspeechend = () => log("onspeechend");
    rec.onsoundend = () => log("onsoundend");
    rec.onaudioend = () => log("onaudioend");
    rec.onnomatch = () => log("onnomatch", "heard something, no match");
    rec.onerror = (e: any) => log("onerror", `${e?.error} ❌`);
    rec.onend = () => { setRunning(false); log("onend", "session ended (Chrome does this on silence — restart to keep going)"); };
    rec.onresult = (e: any) => {
      let it = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript ?? "";
        if (r.isFinal) { log("FINAL ✅", txt.trim()); setFinals((p) => [...p, txt.trim()]); }
        else it += txt;
      }
      setInterim(it);
      if (it.trim()) log("interim", it.trim());
    };
    try { rec.start(); log("start()", "called"); }
    catch (e: any) { log("start()", `THREW ❌ ${e?.message}`); }
  };

  const stopAll = () => {
    try { recRef.current?.abort(); } catch {}
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    log("stopped");
  };

  useEffect(() => () => { try { recRef.current?.abort(); } catch {}; if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <main className="min-h-screen bg-bg p-6 font-mono text-fg">
      <h1 className="mb-1 font-display text-2xl tracking-tightest">
        lazybull<span className="text-bull">.mic-check</span>
      </h1>
      <p className="mb-5 text-[0.6875rem] text-fg-dim">
        Raw Web Speech diagnostic — no app logic. Run this in <b>real Chrome</b> (not an embedded preview pane).
      </p>

      <section className="mb-5 border border-border bg-bg-soft p-3">
        <h2 className="mb-2 t-eyebrow text-fg-faint">1 · environment</h2>
        <div className="grid gap-1 text-[0.6875rem]">
          {Object.entries(env).map(([k, v]) => (
            <div key={k} className="flex gap-2"><span className="w-44 shrink-0 text-fg-faint">{k}</span><span className="break-all">{v}</span></div>
          ))}
          <div className="flex gap-2"><span className="w-44 shrink-0 text-fg-faint">Mic permission</span><span>{permission}</span></div>
        </div>
      </section>

      <section className="mb-5 border border-border bg-bg-soft p-3">
        <h2 className="mb-2 t-eyebrow text-fg-faint">2 · microphone + input level</h2>
        <button onClick={testMic} className="mb-3 bg-bull px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim">
          request mic &amp; show level
        </button>
        <div className="mb-2 h-3 w-full max-w-md border border-border bg-bg">
          <div className="h-full bg-bull transition-[width] duration-75" style={{ width: `${level}%` }} />
        </div>
        <p className="text-[0.625rem] text-fg-faint">Talk — this bar must move. If it doesn&apos;t, it&apos;s an OS/device/permission issue, not the app.</p>
        {devices.length > 0
          ? <div className="mt-2 text-[0.625rem] text-fg-dim">inputs: {devices.join(" · ")}</div>
          : <div className="mt-2 text-[0.625rem] text-bear">no audio input devices visible to the browser — connect a mic/headset, then reload</div>}
      </section>

      <section className="mb-5 border border-border bg-bg-soft p-3">
        <h2 className="mb-2 t-eyebrow text-fg-faint">3 · speech recognition</h2>
        <div className="mb-3 flex gap-2">
          <button onClick={startRecognition} className="bg-cyan px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-bg hover:opacity-80">
            {running ? "restart listening" : "start listening"}
          </button>
          <button onClick={stopAll} className="border border-border px-3 py-1.5 text-[0.6875rem] uppercase tracking-wider text-fg-dim hover:text-fg">stop</button>
          <span className={`self-center text-[0.6875rem] ${running ? "text-bull" : "text-fg-faint"}`}>{running ? "● listening" : "○ idle"}</span>
        </div>
        <div className="mb-2 min-h-[2rem] border border-dashed border-bull/40 p-2 text-[0.75rem] italic text-fg-dim">
          {interim || "(interim transcript appears here as you speak)"}
        </div>
        {finals.length > 0 && (
          <div className="text-[0.75rem]"><span className="text-fg-faint">finals:</span> {finals.map((f, i) => <span key={i} className="mr-2 text-bull">“{f}”</span>)}</div>
        )}
      </section>

      <section className="border border-border bg-bg-soft p-3">
        <h2 className="mb-2 t-eyebrow text-fg-faint">4 · event log (copy this to Claude)</h2>
        <div className="max-h-72 overflow-y-auto bg-bg p-2 text-[0.6875rem] leading-relaxed">
          {lines.length === 0 && <div className="text-fg-faint">(no events yet — press the buttons above)</div>}
          {lines.map((l, i) => (
            <div key={i}><span className="text-fg-faint">{l.t}</span> <span className="text-cyan">{l.name}</span>{l.detail ? <span className="text-fg-dim"> — {l.detail}</span> : null}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
