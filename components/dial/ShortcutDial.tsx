"use client";

/**
 * THE SHORTCUT DIAL (owner's reference, 2026-11-09): the bottom-left corner of
 * every page. An arc of the visitor's own shortcuts with the page they are on
 * lit, the same object as the Island's dial in the other corner of the eye.
 *
 * At rest it is small and out of the way; the pointer or keyboard focus opens
 * it to full size with its labels. A tap on a touch screen opens it first, so
 * a shortcut is never followed by accident. The gear edits the set: for every
 * page, or for just this one (lib/shortcuts.ts).
 *
 * It recedes while the film is pinned (globals.css, THE DIAL).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  BookOpen,
  Briefcase,
  CandlestickChart,
  Dumbbell,
  Home,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sigma,
  Table2,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";
import { TogglePill } from "@/components/calm/kit";
import { setMotionPaused, isMotionPaused, useMotionPaused } from "@/lib/motion/bus";
import {
  DEFAULT_SLOTS,
  MAX_SLOTS,
  SHORTCUTS,
  activeSlot,
  saveShortcuts,
  shortcutById,
  slotsFor,
  useSavedShortcuts,
  withSlots,
  withoutPage,
  type Shortcut,
} from "@/lib/shortcuts";

const ICONS: Record<string, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  home: Home,
  builder: TrendingUp,
  chain: Table2,
  pro: CandlestickChart,
  portfolio: Briefcase,
  learn: BookOpen,
  practice: Dumbbell,
  greeks: Sigma,
  quant: Bot,
  pricing: Tag,
  safety: ShieldCheck,
  search: Search,
  pause: Pause,
};

// The dial's own geometry, in px: a wide arc rising from the corner.
const W = 272;
const H = 160;
const CX = 136;
const CY = 150;
const R = 112;
const STROKE = 34;
const GEAR_ANGLE = -175;

const rad = (d: number) => (d * Math.PI) / 180;
const polar = (angle: number, r = R) => [CX + r * Math.cos(rad(angle)), CY + r * Math.sin(rad(angle))] as const;

/** Round caps eat into a segment, so the drawn sweep is shorter than the step. */
function arcPath(mid: number, sweep: number) {
  const [x1, y1] = polar(mid - sweep / 2);
  const [x2, y2] = polar(mid + sweep / 2);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const NO_DIAL = /^\/(admin|pro\/mic-check)(\/|$)/;

/** Pages with their own bars along the bottom edge lift the dial clear of them. */
const liftFor = (path: string) => (/^\/pro(\/|$)/.test(path) ? "pro" : path === "/trade" ? "trade" : undefined);

export function ShortcutDial() {
  const pathname = usePathname() || "/";
  const saved = useSavedShortcuts();
  const paused = useMotionPaused();
  const { ids, own } = slotsFor(saved, pathname);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const closeTimer = useRef(0);
  const gearRef = useRef<HTMLButtonElement>(null);
  const uid = useId().replace(/:/g, "");

  const lit = activeSlot(ids, pathname);
  const n = ids.length;
  const step = n > 1 ? Math.min(30, 120 / (n - 1)) : 0;
  const angleOf = (i: number) => -90 + (i - (n - 1) / 2) * step;
  const sweep = Math.max(2, (step || 30) - 21);

  const show = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const hide = useCallback((after = 260) => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setHot(null);
    }, after);
  }, []);

  // A new page starts with the dial folded and the editor shut.
  useEffect(() => {
    setOpen(false);
    setEditing(false);
    setHot(null);
  }, [pathname]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // A touch screen has no pointer to leave with: a tap elsewhere folds it.
  useEffect(() => {
    if (!open || editing) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(".dial-root")) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, editing]);

  useEffect(() => {
    if (!open && !editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editing) {
        setEditing(false);
        gearRef.current?.focus();
      } else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing]);

  if (NO_DIAL.test(pathname)) return null;

  const expanded = open || editing;
  const lift = liftFor(pathname);
  const label = hot ?? (lit >= 0 ? shortcutById(ids[lit])?.label : null) ?? "Your shortcuts";

  const runAction = (s: Shortcut) => {
    if (s.action === "pause") setMotionPaused(!isMotionPaused());
    if (s.action === "search") window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };

  return (
    <>
      <nav
        aria-label="Your shortcuts"
        className="dial-root"
        data-open={expanded || undefined}
        data-lift={lift}
        style={{ width: W, height: H }}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && !editing && hide()}
        onFocusCapture={(e) => (e.target as HTMLElement).matches(":focus-visible") && show()}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !editing) hide(120);
        }}
        // On a touch screen the first tap opens it; only then are its shortcuts live.
        onClickCapture={(e) => {
          if (expanded) return;
          e.preventDefault();
          e.stopPropagation();
          show();
        }}
      >
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="pointer-events-none absolute inset-0 overflow-visible">
          <defs>
            <linearGradient id={`${uid}-ramp`} gradientUnits="userSpaceOnUse" x1={CX - R} y1="0" x2={CX + R} y2="0">
              <stop offset="0" stopColor="var(--edge-a)" />
              <stop offset="0.55" stopColor="var(--edge-b)" />
              <stop offset="1" stopColor="var(--edge-c)" />
            </linearGradient>
            <radialGradient id={`${uid}-well`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R + 34}>
              <stop offset="0.45" stopColor="var(--bg)" stopOpacity="0.55" />
              <stop offset="0.9" stopColor="var(--bg)" stopOpacity="0.92" />
              <stop offset="1" stopColor="var(--bg)" stopOpacity="0" />
            </radialGradient>
            <filter id={`${uid}-glow`} filterUnits="userSpaceOnUse" x="-20" y="-40" width={W + 40} height={H + 60}>
              <feGaussianBlur stdDeviation="10" />
            </filter>
          </defs>
          <circle cx={CX} cy={CY} r={R + 34} fill={`url(#${uid}-well)`} className="dial-well" />
          {/* the lit hairline round the outside: the panels' edge, bent */}
          <path
            d={`M${polar(-172, R + 28).map((v) => v.toFixed(1)).join(" ")} A${R + 28} ${R + 28} 0 0 1 ${polar(-8, R + 28).map((v) => v.toFixed(1)).join(" ")}`}
            fill="none"
            stroke={`url(#${uid}-ramp)`}
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          {ids.map((id, i) =>
            i === lit ? null : (
              <g key={id}>
                {/* its own backing, so it reads over a busy chart with no disc behind it */}
                <path d={arcPath(angleOf(i), sweep)} fill="none" stroke="var(--bg)" strokeOpacity="0.82" strokeWidth={STROKE} strokeLinecap="round" />
                <path
                  d={arcPath(angleOf(i), sweep)}
                  fill="none"
                  stroke="var(--fg)"
                  strokeOpacity={hot === shortcutById(id)?.label ? 0.2 : 0.09}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  className="transition-[stroke-opacity] duration-200"
                />
              </g>
            )
          )}
          {lit >= 0 && (
            <>
              <path d={arcPath(angleOf(lit), sweep)} fill="none" stroke={`url(#${uid}-ramp)`} strokeOpacity="0.65" strokeWidth={STROKE + 8} strokeLinecap="round" filter={`url(#${uid}-glow)`} />
              <path d={arcPath(angleOf(lit), sweep)} fill="none" stroke={`url(#${uid}-ramp)`} strokeWidth={STROKE + 4} strokeLinecap="round" />
            </>
          )}
        </svg>

        {ids.map((id, i) => {
          const s = shortcutById(id);
          if (!s) return null;
          const [x, y] = polar(angleOf(i));
          const Icon = id === "pause" && paused ? Play : ICONS[id];
          const name = id === "pause" && paused ? "Resume motion" : s.label;
          const common = {
            "aria-label": name,
            title: name,
            className: `dial-slot ${i === lit ? "dial-slot-lit" : ""}`,
            style: { left: x - 22, top: y - 22 },
            onPointerEnter: () => setHot(name),
            onPointerLeave: () => setHot(null),
            onFocus: () => setHot(name),
            onBlur: () => setHot(null),
          };
          return s.href ? (
            // Fetched once the dial is opened: at load these five pages would blow frame zero's byte budget.
            <Link key={id} href={s.href} prefetch={expanded ? "auto" : false} aria-current={i === lit ? "page" : undefined} {...common}>
              <Icon size={18} aria-hidden />
            </Link>
          ) : (
            <button key={id} type="button" onClick={() => runAction(s)} {...common}>
              <Icon size={18} aria-hidden />
            </button>
          );
        })}

        <button
          ref={gearRef}
          type="button"
          aria-label="Edit your shortcuts"
          aria-expanded={editing}
          title="Edit your shortcuts"
          onClick={() => setEditing((v) => !v)}
          className="dial-slot dial-gear"
          style={{ left: polar(GEAR_ANGLE)[0] - 22, top: polar(GEAR_ANGLE)[1] - 22 }}
        >
          <Settings2 size={16} aria-hidden />
        </button>

        <div aria-hidden className="dial-label" style={{ left: CX - 70, top: CY - 42 }}>
          {label}
        </div>
      </nav>

      {editing && (
        <DialEditor
          path={pathname}
          ids={ids}
          own={own}
          lift={lift}
          onClose={() => {
            setEditing(false);
            gearRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

function DialEditor({ path, ids, own, lift, onClose }: { path: string; ids: string[]; own: boolean; lift?: string; onClose: () => void }) {
  const saved = useSavedShortcuts();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const write = (next: string[]) => saveShortcuts(withSlots(saved, path, own, next));
  const move = (i: number, by: -1 | 1) => {
    const next = [...ids];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  };
  const setScope = (page: boolean) => {
    if (page === own) return;
    saveShortcuts(page ? withSlots(saved, path, true, ids) : withoutPage(saved, path));
  };
  const available = SHORTCUTS.filter((s) => !ids.includes(s.id));
  const full = ids.length >= MAX_SLOTS;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Edit your shortcuts"
      data-lift={lift}
      className="dial-editor rounded-[22px] bg-bg shadow-2xl outline-none"
    >
      <div className="glass-tool max-h-[min(70vh,34rem)] overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1rem] font-semibold tracking-[-0.01em] text-fg">Your shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-fg-faint transition-colors hover:text-fg">
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-1 t-label text-fg-dim">Up to {MAX_SLOTS}. Saved in this browser.</p>

        <div role="group" aria-label="Where these apply" className="mt-3 flex flex-wrap gap-1.5">
          <TogglePill on={!own} onClick={() => setScope(false)}>All pages</TogglePill>
          <TogglePill on={own} onClick={() => setScope(true)}>Only this page</TogglePill>
        </div>

        <ul className="mt-3 flex flex-col">
          {ids.map((id, i) => {
            const s = shortcutById(id);
            const Icon = ICONS[id];
            if (!s) return null;
            return (
              <li key={id} className="flex items-center gap-2.5 py-1.5">
                <span className="text-brand-ink"><Icon size={16} aria-hidden /></span>
                <span className="min-w-0 flex-1 truncate text-[0.875rem] text-fg">{s.label}</span>
                <button type="button" aria-label={`Move ${s.label} earlier`} disabled={i === 0} onClick={() => move(i, -1)} className="dial-mini"><ArrowUp size={15} aria-hidden /></button>
                <button type="button" aria-label={`Move ${s.label} later`} disabled={i === ids.length - 1} onClick={() => move(i, 1)} className="dial-mini"><ArrowDown size={15} aria-hidden /></button>
                <button type="button" aria-label={`Remove ${s.label}`} disabled={ids.length === 1} onClick={() => write(ids.filter((x) => x !== id))} className="dial-mini"><X size={15} aria-hidden /></button>
              </li>
            );
          })}
        </ul>

        {available.length > 0 && (
          <>
            <div className="mt-3 t-label text-fg-faint">{full ? "Remove one to add another" : "Add"}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {available.map((s) => (
                <TogglePill key={s.id} on={false} disabled={full} onClick={() => write([...ids, s.id])} className="disabled:opacity-40">
                  <Plus size={12} aria-hidden className="mr-1" />
                  {s.label}
                </TogglePill>
              ))}
            </div>
          </>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => (own ? saveShortcuts(withoutPage(saved, path)) : write([...DEFAULT_SLOTS]))}
            className="t-label text-fg-faint underline decoration-dotted underline-offset-2 transition-colors hover:text-fg"
          >
            {own ? "Use the all-pages set here" : "Reset to the default set"}
          </button>
        </div>
      </div>
    </div>
  );
}

