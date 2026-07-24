"use client";

// React binding for the StreamingManager. Components call useLiveQuotes(symbols)
// instead of running their own poll; the manager coalesces every subscriber onto
// ONE EventSource and pushes updates back. Re-subscribes only when the symbol
// SET changes by value, so re-renders with the same symbols cost nothing.

import { useEffect, useState } from "react";
import { streamingManager, type QuoteMap } from "./manager";
import type { Quote } from "@/lib/market-data/provider";

export function useLiveQuotes(symbols: string[]): QuoteMap {
  const [quotes, setQuotes] = useState<QuoteMap>({});
  // Stable, order-insensitive key so [A,B] and [B,A] don't re-subscribe.
  const key = [...new Set(symbols.map((s) => s.toUpperCase()))].sort().join(",");

  useEffect(() => {
    const syms = key ? key.split(",") : [];
    if (!syms.length) {
      setQuotes({});
      return;
    }
    setQuotes({}); // drop symbols from the previous set; snapshot repopulates below
    const unsub = streamingManager.subscribe(syms, (incoming) => {
      setQuotes((prev) => ({ ...prev, ...incoming }));
    });
    return unsub;
  }, [key]);

  return quotes;
}

/** Single-symbol convenience. */
export function useLiveQuote(symbol?: string | null): Quote | undefined {
  const map = useLiveQuotes(symbol ? [symbol] : []);
  return symbol ? map[symbol.toUpperCase()] : undefined;
}
