"use client";

// Named quant setups, saved to the signed-in user's profile via the existing
// /api/workspaces backend (kind:"quant"). A setup is the whole experiment:
// symbol, window, data mode, the seed-tape knobs and the active bot stack with
// its tuned params — enough to reproduce a run on another device. Custom
// imported bots are code, not config, so they're deliberately not included.

import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { track } from "@/lib/track";
import { PillButton } from "@/components/calm/kit";
import { UpgradeNudge } from "@/components/billing/UpgradeNudge";
import { isPaywall, type PaywallBody } from "@/lib/billing/gate";

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
  // The plan's saved-workspace cap (setups are workspaces) — the 402 body
  // from lib/billing/gate.ts, rendered as the nudge rather than a failure.
  const [nudge, setNudge] = useState<PaywallBody | null>(null);
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
      if (isPaywall(r.status, j)) {
        setNudge(j);
        return;
      }
      if (j?.ok) {
        setName("");
        say(`Saved “${trimmed}”`);
        const s = getState();
        track("setup_saved", { symbol: s.symbol, mode: s.mode, bots: s.active.length });
        void refresh();
      } else {
        say(j?.error === "unauth" ? "Sign in to save setups" : "Save failed");
      }
    } catch {
      say("Save failed — offline?");
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
      <PillButton
        size="sm"
        onClick={() => signIn("google", { callbackUrl: "/quant" })}
        title="Setups save to your profile — symbol, mode, knobs and the whole bot stack"
      >
        ⇪ Sign in to save setups
      </PillButton>
    );
  }

  return (
    <div ref={boxRef} className="t-label relative flex items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
        placeholder="Setup name…"
        aria-label="Setup name"
        className="calm-input w-32"
      />
      <PillButton size="sm" onClick={() => void save()} disabled={busy}>
        Save
      </PillButton>
      <PillButton size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        My setups {open ? "▴" : "▾"}
      </PillButton>
      {note && <span className="ml-1 text-fg-faint">{note}</span>}

      {nudge && (
        <div className="absolute right-0 top-10 z-40 w-80">
          <UpgradeNudge paywall={nudge} onClose={() => setNudge(null)} />
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-10 z-40 w-72 surface-instrument border border-border bg-surface shadow-2xl">
          {items === null ? (
            <div className="px-3 py-3 text-fg-faint">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-3 text-fg-faint">
              No saved setups yet — name one and hit save.
            </div>
          ) : (
            items.map((it) => (
              <div key={it._id} className="flex items-center gap-2 border-b border-border-soft px-2 py-1.5 last:border-b-0">
                <button
                  onClick={() => {
                    onApply(it.state);
                    setOpen(false);
                    say(`Applied “${it.name}”`);
                    track("setup_applied", { symbol: it.state?.symbol ?? null, mode: it.state?.mode ?? null });
                  }}
                  className="flex-1 truncate text-left text-fg hover:text-brand-ink"
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
                  className="shrink-0 text-fg-faint hover:text-fg"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <div className="border-t border-border-soft px-3 py-1.5 text-fg-faint">
            Custom imported bots aren’t saved — they’re code, not config
          </div>
        </div>
      )}
    </div>
  );
}
