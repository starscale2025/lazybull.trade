"use client";

import { motion } from "motion/react";
import type { CSSProperties } from "react";

type Props = { size?: number; color?: string; style?: CSSProperties };

// Delta — walking person whose progress bar fills with strides.
export function DeltaIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <motion.g
        animate={{ x: [0, 6, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="9" cy="6" r="1.6" fill={color} />
        <path d="M9 9v5l-2 5" />
        <path d="M9 14l3 4" />
      </motion.g>
      <line x1="3" y1="22" x2="21" y2="22" stroke={color} strokeOpacity="0.25" />
      <motion.rect
        x="3" y="21" height="2" rx="0"
        fill={color}
        animate={{ width: [0, 18, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

// Gamma — accelerating car whose wheels spin.
export function GammaIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14h2l1.5-4h9L17 14h4v3h-2" />
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
        style={{ originX: "8px", originY: "17px", transformBox: "fill-box" }}
      >
        <circle cx="8" cy="17" r="2" />
        <line x1="8" y1="15" x2="8" y2="19" />
      </motion.g>
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
        style={{ originX: "16px", originY: "17px", transformBox: "fill-box" }}
      >
        <circle cx="16" cy="17" r="2" />
        <line x1="16" y1="15" x2="16" y2="19" />
      </motion.g>
      <motion.g
        animate={{ opacity: [0.2, 1, 0.2], x: [-1, -3, -1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        <path d="M2 20l2-1M2 18l3-1" />
      </motion.g>
    </svg>
  );
}

// Theta — clock with sweeping hands and a slight melt.
export function ThetaIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <motion.g
        animate={{ scaleY: [1, 0.92, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        style={{ originX: "12px", originY: "12px", transformBox: "fill-box" }}
      >
        <circle cx="12" cy="12" r="8" />
        <motion.line
          x1="12" y1="12" x2="12" y2="7"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          style={{ originX: "12px", originY: "12px", transformBox: "fill-box" }}
        />
        <motion.line
          x1="12" y1="12" x2="15" y2="13"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ originX: "12px", originY: "12px", transformBox: "fill-box" }}
        />
      </motion.g>
    </svg>
  );
}

// Vega — shaking thermometer with bulb pulse.
export function VegaIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <motion.g
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "12px", originY: "20px", transformBox: "fill-box" }}
      >
        <path d="M10 4a2 2 0 0 1 4 0v10.2a4 4 0 1 1-4 0V4z" />
        <motion.circle
          cx="12" cy="18" r="2.2"
          fill={color}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{ originX: "12px", originY: "18px", transformBox: "fill-box" }}
        />
        <motion.line
          x1="12" y1="14"
          x2="12" y2="6"
          stroke={color}
          strokeWidth="2"
          animate={{ scaleY: [1, 0.55, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: "12px", originY: "14px", transformBox: "fill-box" }}
        />
      </motion.g>
    </svg>
  );
}

// Rho — interest-rate dial.
export function RhoIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <motion.line
        x1="12" y1="12" x2="12" y2="5"
        animate={{ rotate: [-30, 60, -30] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "12px", originY: "12px", transformBox: "fill-box" }}
      />
      <text x="6" y="14" fontFamily="monospace" fontSize="3" fill={color}>0%</text>
      <text x="14" y="14" fontFamily="monospace" fontSize="3" fill={color}>10%</text>
    </svg>
  );
}

// Implied vol — wave that scales vertically (cleaner than animating `d`).
export function IvIcon({ size = 24, color = "currentColor" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="M2 12 Q 5 4 8 12 T 14 12 T 20 12 T 22 12"
        animate={{ scaleY: [1, 1.6, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "12px", originY: "12px", transformBox: "fill-box" }}
      />
    </svg>
  );
}

export type GreekKey = "delta" | "gamma" | "theta" | "vega" | "rho" | "iv";

export const GreekMeta: Record<
  GreekKey,
  { label: string; title: string; body: string; Icon: (p: Props) => React.JSX.Element; color: string }
> = {
  delta: {
    label: "Δ",
    title: "Delta — directional speed",
    body: "Delta is like a walking progress bar. It tells you how much the option moves when the stock moves $1, and roughly the chance of finishing in the money.",
    Icon: DeltaIcon,
    color: "var(--bull)",
  },
  gamma: {
    label: "Γ",
    title: "Gamma — acceleration",
    body: "Gamma is the option's acceleration. It tells you how fast Delta itself changes — biggest near the money, near expiry.",
    Icon: GammaIcon,
    color: "var(--cyan)",
  },
  theta: {
    label: "Θ",
    title: "Theta — time decay",
    body: "Theta is your melting ice cube. Every day that passes, the option loses a bit of value. It's the rent you pay for holding optionality.",
    Icon: ThetaIcon,
    color: "var(--amber)",
  },
  vega: {
    label: "ν",
    title: "Vega — volatility sensitivity",
    body: "Vega is a shaking thermometer. When the market gets nervous, implied vol rises — and Vega says how much that boosts your option's price.",
    Icon: VegaIcon,
    color: "var(--plasma)",
  },
  rho: {
    label: "ρ",
    title: "Rho — interest-rate dial",
    body: "Rho measures sensitivity to interest rates. Calls love higher rates, puts dislike them. Usually small unless you're holding LEAPS.",
    Icon: RhoIcon,
    color: "var(--bear)",
  },
  iv: {
    label: "IV",
    title: "Implied Volatility",
    body: "IV is the market's guess of how wild the stock will be. High IV = expensive options. The chain heatmap colors cells by IV.",
    Icon: IvIcon,
    color: "var(--bull)",
  },
};
