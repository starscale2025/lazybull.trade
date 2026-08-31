"use client";

// Named quant setups, saved to the signed-in user's profile via the existing
// /api/workspaces backend (kind:"quant"). A setup is the whole experiment:
// symbol, window, data mode, the seed-tape knobs and the active bot stack with
// its tuned params — enough to reproduce a run on another device. Custom
// imported bots are code, not config, so they're deliberately not included.

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { track } from "@/lib/track";

export type QuantSetupState = {
  symbol: string;
  bars: number;
  mode: "live" | "seed";
  seed: number;
  drift: number;
  vol: number;
  active: { defId: string; params: Record<string, number | string | boolean> }[];
};

type SetupDoc = { _id: string; name: string; updatedAt: string; state: QuantSetupState };

export function SetupsBar({
  getState,
  onApply,
}: {
  getState: () => QuantSetupState;
  onApply: (s: QuantSetupState) => void;
}) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SetupDoc[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const say = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((cur) => (cur === msg ? null : cur)), 3500);
  };

  const refresh = async () => {
    try {
      const r = await fetch("/api/workspaces?kind=quant");
      const j = await r.json();
      if (j?.ok && Array.isArray(j.items)) setItems(j.items as SetupDoc[]);
    } catch {
      /* list stays as-is */
    }
  };

  useEffect(() => {
    if (open && status === "authenticated") void refresh();
  }, [open, status]);

  // Click-away closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const save = async () => {
    const trimmed = name.trim() || `${getState().symbol} · ${getState().mode}`;
    setBusy(true);
    try {
      const r = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "quant", name: trimmed, state: getState() }),
      });
      const j = await r.json();
      if (j?.ok) {
        setName("");
        say(`saved "${trimmed}"`);
        const s = getState();
        track("setup_saved", { symbol: s.symbol, mode: s.mode, bots: s.active.length });
        void refresh();
      } else {
        say(j?.error === "unauth" ? "sign in to save setups" : "save failed");
      }
    } catch {
      say("save failed — offline?");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
      setItems((cur) => (cur ? cur.filter((x) => x._id !== id) : cur));
    } catch {
      /* row stays — next refresh reconciles */
    }
  };

  if (status !== "authenticated") {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/quant" })}
        title="Setups save to your profile — symbol, mode, knobs and the whole bot stack"
        className="flex items-center gap-2 surface-instrument border border-border bg-surface px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
      >
        ⇪ sign in to save setups
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
        placeholder="setup name…"
        aria-label="Setup name"
        className="w-28 border border-border bg-bg px-2 py-1 normal-case tracking-normal text-fg outline-none placeholder:text-fg-faint focus:border-bull"
      />
      <button
        onClick={() => void save()}
        disabled={busy}
        className="border border-bull/50 bg-bull/10 px-2 py-1 text-bull transition-colors hover:bg-bull hover:text-bg disabled:opacity-40"
      >
        save
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="surface-instrument border border-border bg-surface px-2 py-1 text-fg-dim transition-colors hover:text-fg"
      >
        my setups {open ? "▴" : "▾"}
      </button>
      {note && <span className="ml-1 text-fg-faint normal-case tracking-normal">{note}</span>}

      {open && (
        <div className="absolute right-0 top-8 z-40 w-72 surface-instrument border border-border bg-surface shadow-2xl">
          {items === null ? (
            <div className="px-3 py-3 text-fg-faint">loading…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-3 normal-case tracking-normal text-fg-faint">
              No saved setups yet — name one and hit save.
            </div>
          ) : (
            items.map((it) => (
              <div key={it._id} className="flex items-center gap-2 border-b border-border-soft px-2 py-1.5 last:border-b-0">
                <button
                  onClick={() => {
                    onApply(it.state);
                    setOpen(false);
                    say(`applied "${it.name}"`);
                    track("setup_applied", { symbol: it.state?.symbol ?? null, mode: it.state?.mode ?? null });
                  }}
                  className="flex-1 truncate text-left normal-case tracking-normal text-fg hover:text-bull"
                  title={`${it.state.symbol} · ${it.state.mode} · ${it.state.active?.length ?? 0} bots`}
                >
                  {it.name}
                </button>
                <span className="shrink-0 text-fg-faint">
                  {new Date(it.updatedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
                </span>
                <button
                  onClick={() => void remove(it._id)}
                  aria-label={`Delete setup ${it.name}`}
                  className="shrink-0 text-fg-faint hover:text-bear"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <div className="border-t border-border-soft px-3 py-1.5 text-[0.625rem] normal-case tracking-normal text-fg-faint">
            custom imported bots aren't saved — they're code, not config
          </div>
        </div>
      )}
    </div>
  );
}
