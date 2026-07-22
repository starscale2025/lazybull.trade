"use client";

// ⌘K — THE OPERATOR'S DECK. Every action on the current page, fuzzy-searched,
// each row showing its direct hotkey where one exists. Mounted once in the
// root layout; pages contribute commands through registerCommands (see
// lib/command-deck.ts). First Tab press on /pro surfaces a one-time coach
// mark, because the keyboard path is a feature, not a fallback.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { deckSnapshot, registerCommands, subscribeDeck, type DeckCommand } from "@/lib/command-deck";

function useDeckCommands(): DeckCommand[] {
  return useSyncExternalStore(subscribeDeck, deckSnapshot, deckSnapshot);
}

export function CommandDeck() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [coach, setCoach] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useDeckCommands();

  // Base commands: navigation + site-wide toggles, always present.
  useEffect(() => {
    const go = (href: string) => () => router.push(href);
    return registerCommands("global", [
      { id: "nav-trade", label: "Open the visual chain", group: "navigate", run: go("/trade") },
      { id: "nav-chain", label: "Open the options chain", group: "navigate", run: go("/trade/chain") },
      { id: "nav-pro", label: "Open pro charts", group: "navigate", run: go("/pro") },
      { id: "nav-quant", label: "Open the quant workbench", group: "navigate", run: go("/quant") },
      { id: "nav-portfolio", label: "Open your portfolio", group: "navigate", run: go("/portfolio") },
      { id: "nav-greeks", label: "Open the Greeks lab", group: "navigate", run: go("/greeks") },
      { id: "nav-learn", label: "Open learn", group: "navigate", run: go("/learn") },
      {
        id: "toggle-contrast",
        label: "Toggle contrast mode (radar / stealth)",
        group: "view",
        run: () => {
          const root = document.documentElement;
          const stealth = root.dataset.contrast === "stealth";
          if (stealth) {
            delete root.dataset.contrast;
            try { localStorage.removeItem("lb-contrast"); } catch {}
          } else {
            root.dataset.contrast = "stealth";
            try { localStorage.setItem("lb-contrast", "stealth"); } catch {}
          }
        },
      },
      {
        id: "replay-film",
        label: "Replay the landing film",
        group: "view",
        run: () => {
          try { sessionStorage.setItem("lb-cinema-replay", "1"); } catch {}
          window.location.assign("/");
        },
      },
    ]);
  }, [router]);

  // ⌘K / Ctrl+K toggles; the palette owns its own keys while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setQ("");
            setActive(0);
          }
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // One-time coach mark: the first Tab on /pro teaches the deck.
  useEffect(() => {
    if (pathname !== "/pro") return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      try {
        if (localStorage.getItem("lb-deck-coach") === "1") return;
        localStorage.setItem("lb-deck-coach", "1");
      } catch {}
      setCoach(true);
      window.setTimeout(() => setCoach(false), 4500);
      window.removeEventListener("keydown", onTab);
    };
    window.addEventListener("keydown", onTab);
    return () => window.removeEventListener("keydown", onTab);
  }, [pathname]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? commands.filter((c) => c.label.toLowerCase().includes(needle) || c.group.includes(needle))
      : commands;
    return list.slice(0, 12);
  }, [commands, q]);

  const runCmd = (cmd: DeckCommand | undefined) => {
    if (!cmd) return;
    setOpen(false);
    cmd.run();
  };

  return (
    <>
      {coach && (
        <div className="fixed bottom-6 left-1/2 z-[140] -translate-x-1/2 border border-bull/50 bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bull shadow-2xl">
          ⌘K — the whole desk, no mouse
        </div>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[140] flex items-start justify-center bg-black/60 pt-[14vh] backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command deck"
            className="w-[480px] max-w-[92vw] border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">command deck</span>
              <kbd className="ml-auto border border-border px-1.5 font-mono text-[10px] text-fg-faint">esc</kbd>
            </div>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  runCmd(filtered[active]);
                }
              }}
              placeholder="Type a command…"
              aria-label="Search commands"
              className="w-full border-b border-border bg-surface px-3 py-3 font-mono text-[14px] text-fg outline-none placeholder:text-fg-faint"
            />
            <div role="listbox" aria-label="Commands" className="max-h-[46vh] overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-4 font-mono text-[11px] text-fg-faint">No matching commands.</div>
              )}
              {filtered.map((c, i) => (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => runCmd(c)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[12px] ${
                    i === active ? "bg-surface-2 text-fg" : "text-fg-dim"
                  }`}
                >
                  <span className="w-16 shrink-0 border border-border-soft px-1 text-center text-[10px] uppercase tracking-wider text-fg-faint">
                    {c.group}
                  </span>
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hotkey && (
                    <kbd className="shrink-0 border border-border px-1.5 font-mono text-[10px] text-fg-faint">{c.hotkey}</kbd>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
