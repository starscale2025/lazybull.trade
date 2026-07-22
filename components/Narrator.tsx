"use client";

// Watches the shared paper account and SPEAKS the money moments through
// lib/narrator: every fill (assertive — including which protective exit
// fired), the kill switch, and account resets. Mounted once in the root
// layout; renders nothing.

import { useEffect, useRef } from "react";
import { usePaper, useSafety } from "@/lib/stores";
import { narrate } from "@/lib/narrator";

export function Narrator() {
  const orders = usePaper((s) => s.orders);
  const balanceLog = usePaper((s) => s.balanceLog);
  const killed = useSafety((s) => s.killSwitchTriggered);

  // Fills — same prime-then-diff pattern as the chart's fill ritual, but
  // account-wide (every symbol, every page).
  const statusRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const prev = statusRef.current;
    statusRef.current = new Map(orders.map((o) => [o.id, o.status]));
    if (!prev) return; // priming pass — history is not news
    for (const o of orders) {
      if (o.status !== "filled") continue;
      const was = prev.get(o.id);
      if (was === "filled" || was === "cancelled" || was === "expired") continue;
      const px = o.fillPrice ?? o.limitPrice ?? o.stopPrice;
      const kind = o.reduceOnly
        ? o.type === "stop"
          ? "Stop loss filled — "
          : "Take profit filled — "
        : "Filled — ";
      // Fractional shares get two decimals — nobody needs thirteen digits of
      // quantity read aloud.
      const qty = Number.isInteger(o.qty) ? String(o.qty) : o.qty.toFixed(2);
      narrate(
        `${kind}${o.side === "buy" ? "bought" : "sold"} ${qty} ${o.sym}${
          Number.isFinite(px) ? ` at ${(px as number).toFixed(2)}` : ""
        }.`,
        { assertive: true }
      );
    }
  }, [orders]);

  // Kill switch — the loudest sentence the product can say.
  const killedRef = useRef(killed);
  useEffect(() => {
    if (killed && !killedRef.current) {
      narrate("Kill switch armed — all positions flattened, orders cancelled.", { assertive: true });
    }
    killedRef.current = killed;
  }, [killed]);

  // Resets / capital restarts — polite; the ledger head says which.
  const headRef = useRef<string | null>(null);
  useEffect(() => {
    const head = balanceLog[0];
    if (!head) return;
    if (headRef.current === null) {
      headRef.current = head.id; // prime
      return;
    }
    if (head.id !== headRef.current) {
      headRef.current = head.id;
      if (head.kind === "reset" || head.kind === "capital") {
        narrate(head.note + ".");
      }
    }
  }, [balanceLog]);

  return null;
}
