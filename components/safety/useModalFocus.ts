"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * THE DIALOG CONTRACT, shared.
 *
 * ConsentGate grew this first: focus moves in, Tab wraps, focus comes back,
 * the page stops scrolling. The 2026-11 verification found the /trade safety
 * briefing, the dangerous-trade confirmation and the safety panel had none of
 * it, so a keyboard or screen-reader user met three overlays they could not
 * tell were dialogs, on the exact screens that explain what a trade can lose.
 *
 *   initial   a selector inside the panel to focus first; else the first
 *             focusable; else the panel itself (give it tabIndex={-1})
 *   onEscape  dismissable dialogs close on Escape; required ones omit it and
 *             Escape does nothing
 *
 * A keydown another trap already handled (defaultPrevented) is left alone, so
 * two stacked dialogs never fight over focus. The scroll lock is a class on
 * <html> because `html, body { overflow-x: clip }` stops a body-level lock from
 * reaching the viewport; a counter keeps it on while any dialog is open.
 */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  opts: { initial?: string; onEscape?: () => void } = {}
) {
  const { initial } = opts;
  // Held in a ref so a new callback each render does not re-run the effect
  // (which would yank focus back to the first control on every keystroke).
  const escape = useRef(opts.onEscape);
  escape.current = opts.onEscape;

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const restore = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );
    const first = (initial ? el.querySelector<HTMLElement>(initial) : null) ?? focusables()[0] ?? el;
    first.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        escape.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const a = nodes[0];
      const z = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && el.contains(active);
      if (e.shiftKey && (!inside || active === a)) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && (!inside || active === z)) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    const root = document.documentElement;
    const count = Number(root.dataset.modals || 0) + 1;
    root.dataset.modals = String(count);
    root.classList.add("lb-modal-open");

    return () => {
      document.removeEventListener("keydown", onKey, true);
      const left = Math.max(0, Number(root.dataset.modals || 1) - 1);
      if (left) root.dataset.modals = String(left);
      else {
        delete root.dataset.modals;
        root.classList.remove("lb-modal-open");
      }
      restore?.focus?.();
    };
  }, [open, initial, ref]);
}
