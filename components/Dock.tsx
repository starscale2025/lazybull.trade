"use client";

// THE DOCK — one corner, zero overlap, forever.
//
// Six confirmed occlusions (mic over RESET FUNDS, PLACE A BET over the
// consensus meter / leaderboard / legal disclaimer, avatar over the teacher
// input, bet chip over mobile sliders) all traced to floating controls
// hardcoding the same fixed corner independently. The Dock is the structural
// cure: ONE fixed column at bottom-right, safe-area aware, that every
// floating control must portal into via <DockSlot>. Slots stack in `order`
// (highest first from the bottom); nothing can overlap because nothing else
// is allowed to be fixed.
//
// Rule (enforced by review, soon by lint): no component outside the Dock may
// use `fixed bottom-* right-*`.

import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

const DockContext = createContext<HTMLDivElement | null>(null);

export function DockProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <DockContext.Provider value={host}>
      {children}
      <div
        ref={setHost}
        // flex-col: DOM order = visual order; DockSlot sets CSS `order`.
        className="pointer-events-none fixed z-[90] flex flex-col items-end gap-2"
        style={{
          right: "max(1rem, env(safe-area-inset-right))",
          bottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      />
    </DockContext.Provider>
  );
}

/**
 * A slot in the Dock. Children render inside the shared bottom-right column —
 * the wrapper restores pointer events (the host is pointer-events-none so
 * empty dock space never blocks the page underneath).
 */
export function DockSlot({ order = 0, children }: { order?: number; children: React.ReactNode }) {
  const host = useContext(DockContext);
  if (!host) return null;
  return createPortal(
    <div className="pointer-events-auto flex flex-col items-end gap-2" style={{ order }}>
      {children}
    </div>,
    host
  );
}
