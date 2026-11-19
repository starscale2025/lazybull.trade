"use client";

import { Search } from "lucide-react";
import { openCommandDeck } from "@/lib/command-deck";

/**
 * The mockups' search, as a compact button: it opens the Command Deck (⌘K),
 * which already searches every page and every action on the desk. An icon at
 * every width: the bar's measure is the page's (.shell), and a full search
 * field pushed the right cluster past it at 2xl.
 */
export function NavSearch() {
  return (
    <button
      type="button"
      onClick={openCommandDeck}
      aria-label="Search pages and actions"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      title="Search · ⌘K"
      className="hidden size-8 items-center justify-center rounded-[9px] text-fg-faint transition-colors hover:bg-[var(--deck-raised)] hover:text-fg sm:inline-flex"
    >
      <Search aria-hidden size={15} strokeWidth={1.75} />
    </button>
  );
}
