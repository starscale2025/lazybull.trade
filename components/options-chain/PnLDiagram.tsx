"use client";

import { useMemo } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pnlCurve, type Leg } from "@/lib/pricing";

type Props = {
  legs: Leg[];
  spot: number;
  height?: number;
};

const TICK = { fontFamily: "var(--font-jetbrains)", fontSize: 10, fill: "var(--fg-faint)" };

export function PnLDiagram({ legs, spot, height = 220 }: Props) {
  const data = useMemo(() => pnlCurve(legs, spot, 0.4, 121), [legs, spot]);
  if (legs.length === 0) {
    return (
      <div className="flex h-[13.75rem] items-center justify-center rounded-[12px] border border-dashed border-[var(--deck-rule)] bg-[var(--deck-sunk)] px-6 text-center text-[0.8125rem] leading-relaxed text-fg-faint">
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
  // The payoff line itself in two colours, split exactly at $0: green where
  // the position is in profit, red where it loses. A vertical gradient in the
  // line's own bounding box runs from the curve's highest point (0) to its
  // lowest (1), so $0 sits at hi / (hi − lo) whatever the axis does. Two stops
  // at one offset make it a hard edge, not a ramp. A dead-flat curve has a
  // zero-height box, which would paint nothing, so it takes one solid colour.
  let hi = -Infinity;
  let lo = Infinity;
  for (const d of data) {
    if (d.pnl > hi) hi = d.pnl;
    if (d.pnl < lo) lo = d.pnl;
  }
  const flat = !(hi - lo > 1e-9);
  const zeroAt = flat ? 0 : Math.max(0, Math.min(1, hi / (hi - lo)));
  const lineStroke = flat ? (hi >= 0 ? "var(--bull)" : "var(--bear)") : "url(#pnl-line)";
  // The X axis is categorical (one slot per sample), so a ReferenceLine only
  // finds an x that IS a sample. Spot is the middle sample in exact arithmetic
  // but not always in floats (229.83 lands on 229.82999999999998), and then the
  // spot marker silently was not drawn. Pin it to the nearest sample: the same
  // place to within 1e-12, drawn for every spot.
  let spotX = data[0].s;
  for (const d of data) if (Math.abs(d.s - spot) < Math.abs(spotX - spot)) spotX = d.s;
  return (
    <div className="h-[13.75rem] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* top: 22 keeps the "spot" reference-line label clear of the SVG edge */}
        <ComposedChart data={dataSplit} margin={{ top: 22, right: 12, bottom: 8, left: 12 }}>
          <defs>
            <linearGradient id="pnl-line" x1="0" x2="0" y1="0" y2="1">
              <stop offset={zeroAt} stopColor="var(--bull)" />
              <stop offset={zeroAt} stopColor="var(--bear)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="s"
            tick={TICK}
            tickFormatter={(v) => `$${Math.round(v)}`}
            stroke="var(--deck-rule)"
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={TICK}
            tickFormatter={(v) => `${v >= 0 ? "+" : ""}${Math.round(v)}`}
            stroke="var(--deck-rule)"
            axisLine={false}
            tickLine={false}
            width={50}
          />
          {/* flat tints, no ramps: the profit region green, the loss region
              red. Neither is a tooltip row — they are the curve, clipped. */}
          <Area dataKey="profit" stroke="none" fill="var(--bull)" fillOpacity={0.12} isAnimationActive={false} tooltipType="none" />
          <Area dataKey="loss" stroke="none" fill="var(--bear)" fillOpacity={0.12} isAnimationActive={false} tooltipType="none" />
          {/* $0, a hairline; spot, a dashed bone marker */}
          <ReferenceLine y={0} stroke="var(--deck-rule-hi)" />
          <ReferenceLine
            x={spotX}
            stroke="var(--fg-dim)"
            strokeOpacity={0.6}
            strokeDasharray="3 3"
            label={{ value: "spot", position: "top", fontSize: 10, fill: "var(--fg-dim)", fontFamily: "var(--font-jetbrains)" }}
          />
          <Line
            dataKey="pnl"
            stroke={lineStroke}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3.5, fill: "var(--fg)", stroke: "var(--deck-pane)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--deck-rule-hi)", strokeDasharray: "2 3" }}
            contentStyle={{
              background: "var(--deck-raised)",
              border: "1px solid var(--deck-rule)",
              borderRadius: 10,
              padding: "6px 10px",
              fontFamily: "var(--font-jetbrains)",
              fontSize: 11,
              color: "var(--fg)",
            }}
            labelStyle={{ color: "var(--fg-faint)" }}
            itemStyle={{ color: "var(--fg)", padding: 0 }}
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
