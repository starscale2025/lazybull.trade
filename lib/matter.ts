/**
 * THE MATTER's slots (Phase 3, 2026-11-09).
 *
 * The site has one particle material (components/matter/engine.ts) and one
 * WebGL context for it. Places on a page that want it render a <MatterSlot>,
 * which registers here with the shape it should take; the engine moves its
 * one canvas into whichever slot is most on screen. A plain module store: the
 * engine reads it directly and nothing re-renders when it changes.
 */

export type MatterShape = "sphere" | "ledger" | "bull";

export type MatterSlotEntry = {
  id: string;
  el: HTMLElement;
  shape: MatterShape;
  /** The hero's slot drains into the film's seam as the curtain lifts (M11). */
  drain?: boolean;
};

const slots = new Map<string, MatterSlotEntry>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export function addMatterSlot(slot: MatterSlotEntry) {
  slots.set(slot.id, slot);
  emit();
}

export function removeMatterSlot(id: string) {
  if (slots.delete(id)) emit();
}

export function getMatterSlots(): MatterSlotEntry[] {
  return [...slots.values()];
}

export function onMatterSlots(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
