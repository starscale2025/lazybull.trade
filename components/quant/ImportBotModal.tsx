"use client";

import { useState } from "react";
import { compileCustomBot, SAMPLE_CUSTOM_BOT, type CustomBotInput } from "@/lib/quant/runtime";
import type { BotDef } from "@/lib/quant/types";

export function ImportBotModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (bot: BotDef) => void;
}) {
  const [name, setName] = useState("My EMA bot");
  const [tagline, setTagline] = useState("Custom EMA spread bot.");
  const [glyph, setGlyph] = useState("★");
  const [body, setBody] = useState(SAMPLE_CUSTOM_BOT);
  const [paramsJson, setParamsJson] = useState(`[
  {"key":"fast","label":"Fast","kind":"number","default":8,"min":3,"max":50,"step":1},
  {"key":"slow","label":"Slow","kind":"number","default":21,"min":10,"max":200,"step":1}
]`);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      // Try parsing JSON wrapper first
      try {
        const obj = JSON.parse(text) as CustomBotInput;
        if (obj.body && obj.name) {
          setName(obj.name);
          setTagline(obj.tagline || "");
          setGlyph(obj.glyph || "★");
          setBody(obj.body);
          if (obj.params) setParamsJson(JSON.stringify(obj.params, null, 2));
          return;
        }
      } catch {}
      // Otherwise treat the entire file as the body
      setBody(text);
    };
    reader.readAsText(f);
  }

  function handleImport() {
    setError(null);
    let params: CustomBotInput["params"] = [];
    try {
      params = paramsJson.trim() ? JSON.parse(paramsJson) : [];
      if (!Array.isArray(params)) throw new Error("params must be an array");
    } catch (e) {
      setError(`Invalid params JSON: ${(e as Error).message}`);
      return;
    }
    if (!name.trim()) {
      setError("Give your bot a name");
      return;
    }
    if (!body.trim()) {
      setError("Bot body is empty");
      return;
    }
    try {
      const def = compileCustomBot({ name, tagline, glyph, body, params });
      onImport(def);
      onClose();
    } catch (e) {
      setError(`Compile failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-bg/80 p-4 backdrop-blur-sm">
      <div className="relative flex h-[88vh] w-[min(1100px,96vw)] flex-col border border-border bg-surface">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border bg-bg-soft px-4 py-3">
          <div>
            <div className="font-display text-2xl tracking-tightest text-fg">Import a bot</div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-fg-dim">
              paste code · upload .json · drop a file
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer border border-border bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-fg-dim hover:text-fg">
              <input type="file" accept=".js,.ts,.json,.txt" className="hidden" onChange={handleFile} />
              upload file
            </label>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center border border-border bg-bg font-mono text-[12px] text-fg-dim hover:bg-bear hover:text-bg hover:border-bear"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_320px]">
          {/* code editor */}
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="flex items-center justify-between border-b border-border-soft bg-bg px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
              <span className="text-fg-dim">bot.body — JS / TS</span>
              <span className="text-fg-faint">return result;</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none bg-bg p-3 font-mono text-[12px] leading-relaxed text-fg outline-none"
            />
          </div>

          {/* meta + params */}
          <div className="flex min-h-0 flex-col overflow-y-auto p-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 w-full border border-border bg-bg px-2 font-mono text-[12px] text-fg"
              />
            </Field>
            <Field label="Tagline">
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="h-8 w-full border border-border bg-bg px-2 font-mono text-[12px] text-fg"
              />
            </Field>
            <Field label="Glyph (1-2 chars)">
              <input
                value={glyph}
                maxLength={2}
                onChange={(e) => setGlyph(e.target.value)}
                className="h-8 w-16 border border-border bg-bg px-2 text-center font-mono text-[14px] text-fg"
              />
            </Field>
            <Field label="Params (JSON array)">
              <textarea
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                spellCheck={false}
                rows={8}
                className="w-full resize-none border border-border bg-bg p-2 font-mono text-[11px] leading-relaxed text-fg"
              />
            </Field>

            <div className="mt-2 border border-border-soft bg-bg-soft p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-bull">api</div>
              <ul className="mt-1.5 space-y-1 font-mono text-[10px] leading-relaxed text-fg-dim">
                <li>
                  <span className="text-fg">ctx.candles</span> — {`{o,h,l,c}[]`}
                </li>
                <li>
                  <span className="text-fg">params</span> — your typed params
                </li>
                <li>
                  <span className="text-fg">helpers</span> — sma · ema · rsi · macd · bollinger · zscore · hurst · kalman · sharpe · sortino · maxDrawdown · returns · fmtPct · fmtNum · fmtMoney
                </li>
                <li>
                  <span className="text-fg">return</span> — {`{ signals, metrics, summary, verdict, overlay?, pane?, equity? }`}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border bg-bg-soft px-4 py-3">
          <div className="font-mono text-[11px] text-bear">{error || " "}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 border border-border bg-bg px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg"
            >
              cancel
            </button>
            <button
              onClick={handleImport}
              className="h-9 bg-bull px-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim"
            >
              compile & import →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-fg-faint">{label}</span>
      {children}
    </label>
  );
}
