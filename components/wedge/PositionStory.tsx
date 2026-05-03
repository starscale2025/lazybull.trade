"use client";

import type { Strategy } from "@/lib/models";

export type Bet = {
  id: string;
  symbol: string;
  strategy: Strategy;
  thesisLow: number;
  thesisHigh: number;
  expiry: string;
  spotAtOpen: number;
  openedAt: number;
  cost: number;
  status: "open" | "closed";
  closedPnl?: number;
};

export function storySentence(b: Bet) {
  const dir = b.thesisLow > b.spotAtOpen ? "rises above" : b.thesisHigh < b.spotAtOpen ? "falls below" : "closes between";
  const range = `${b.thesisLow.toFixed(2)} and ${b.thesisHigh.toFixed(2)}`;
  const winChance = `${(b.strategy.prob * 100).toFixed(0)}% odds`;
  const maxL = Number.isFinite(b.strategy.maxLoss) ? `Max loss $${Math.abs(b.strategy.maxLoss).toFixed(0)}` : "Max loss unbounded";
  const maxP = Number.isFinite(b.strategy.maxProfit) ? `$${Math.abs(b.strategy.maxProfit).toFixed(0)}` : "uncapped";
  const cost = b.cost >= 0 ? `paid $${b.cost.toFixed(0)}` : `collected $${Math.abs(b.cost).toFixed(0)}`;
  return `You ${cost} betting ${b.symbol} ${dir} ${range} by ${b.expiry}. You make ${maxP} if right (${winChance}). ${maxL}.`;
}

export function PositionStoryLine({ b }: { b: Bet }) {
  return (
    <p className="text-sm leading-relaxed text-fg">
      {storySentence(b)}
    </p>
  );
}
