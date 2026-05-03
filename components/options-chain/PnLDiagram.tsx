"use client";

import { useMemo } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pnlCurve, type Leg } from "@/lib/pricing";

type Props = {
  legs: Leg[];
  spot: number;
  height?: number;
};

export function PnLDiagram({ legs, spot, height = 220 }: Props) {
  const data = useMemo(() => pnlCurve(legs, spot, 0.4, 121), [legs, spot]);
  if (legs.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center border border-dashed border-border-soft text-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">
        Select strikes from the chain<br />to see the P&L diagram
      </div>
    );
  }
  // Split into positive/negative for two-tone fill
  const dataSplit = data.map((d) => ({
    s: d.s,
    profit: d.pnl >= 0 ? d.pnl : 0,
    loss: d.pnl < 0 ? d.pnl : 0,
    pnl: d.pnl,
  }));
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dataSplit} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <defs>
            <linearGradient id="pnl-bull" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--bull)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--bull)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pnl-bear" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stopColor="var(--bear)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--bear)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="s"
            tick={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, fill: "var(--fg-faint)" }}
            tickFormatter={(v) => `$${Math.round(v)}`}
            stroke="var(--border)"
          />
          <YAxis
            tick={{ fontFamily: "var(--font-jetbrains)", fontSize: 10, fill: "var(--fg-faint)" }}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${Math.round(v)}`}
            stroke="var(--border)"
            width={50}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ReferenceLine
            x={spot}
            stroke="var(--cyan)"
            strokeDasharray="3 3"
            label={{ value: "spot", position: "top", fontSize: 10, fill: "var(--cyan)", fontFamily: "var(--font-jetbrains)" }}
          />
          <Area dataKey="profit" stroke="none" fill="url(#pnl-bull)" isAnimationActive={false} />
          <Area dataKey="loss" stroke="none" fill="url(#pnl-bear)" isAnimationActive={false} />
          <Line
            dataKey="pnl"
            stroke="var(--fg)"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-jetbrains)",
              fontSize: 11,
              color: "var(--fg)",
            }}
            formatter={(v) => {
              const n = typeof v === "number" ? v : Number(v);
              return [`${n >= 0 ? "+" : ""}$${n.toFixed(0)}`, "P&L"];
            }}
            labelFormatter={(v) => `Spot $${Number(v).toFixed(2)}`}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
