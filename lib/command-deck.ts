// The Command Deck registry — every action on the desk, addressable by
// keyboard. Pages register their commands with a scope id (unregister on
// unmount); the deck renders whatever is live right now. This is the a11y
// inversion the audit demanded: losing the mouse shouldn't demote you to a
// second-class user — ⌘K makes the keyboard the power-user path.

export type DeckCommand = {
  id: string;
  label: string;
  /** Small group chip: "navigate", "chart", "trade", "view"… */
  group: string;
  /** Shown as a <kbd> hint when the action also has a direct hotkey. */
  hotkey?: string;
  run: () => void;
};

/** Window event that opens the deck from a control rather than a keystroke —
    the navbar's search button dispatches it (components/NavSearch.tsx) and
    components/CommandDeck.tsx listens. */
export const OPEN_DECK_EVENT = "lb:open-command-deck";

/** Open the Command Deck, as ⌘K would. Safe to call before it mounts. */
export function openCommandDeck(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_DECK_EVENT));
}

const registry = new Map<string, DeckCommand[]>();
const listeners = new Set<() => void>();
let snapshot: DeckCommand[] = [];

function emit() {
  snapshot = [...registry.values()].flat();
  for (const fn of listeners) fn();
}

export function registerCommands(scopeId: string, cmds: DeckCommand[]): () => void {
  registry.set(scopeId, cmds);
  emit();
  return () => {
    registry.delete(scopeId);
    emit();
  };
}

export function subscribeDeck(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function deckSnapshot(): DeckCommand[] {
  return snapshot;
}
