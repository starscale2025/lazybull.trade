"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useTeacher } from "@/lib/stores";
import { GreekMeta, type GreekKey } from "./GreekIcons";

export function TeacherAvatar({ onAsk }: { onAsk?: () => void }) {
  const { bubble, setBubble } = useTeacher();
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3500 + Math.random() * 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {bubble && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-[320px] border border-bull/40 bg-surface text-fg shadow-[0_20px_60px_-20px_rgba(0,255,135,0.4)]"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center border border-border bg-bg" style={{ color: "var(--bull)" }}>
                {bubble.icon in GreekMeta ? (
                  (() => {
                    const Icon = GreekMeta[bubble.icon as GreekKey].Icon;
                    return <Icon size={28} />;
                  })()
                ) : (
                  <span className="font-display text-xl">∂</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base leading-tight tracking-tightest">
                  {bubble.title}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">{bubble.body}</p>
              </div>
              <button
                onClick={() => setBubble(undefined)}
                aria-label="dismiss"
                className="text-fg-faint hover:text-fg transition-colors"
              >
                ✕
              </button>
            </div>
            <span className="absolute -bottom-2 right-7 size-3 rotate-45 border-b border-r border-bull/40 bg-surface" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={onAsk}
        aria-label="AI teacher"
        className="group relative flex size-14 items-center justify-center rounded-full border border-bull/50 bg-bg shadow-[0_0_40px_-10px_rgba(0,255,135,0.7)]"
      >
        <span className="absolute -inset-1 rounded-full bg-bull/20 blur-lg" />
        <svg viewBox="0 0 48 48" width={48} height={48} className="relative">
          <defs>
            <radialGradient id="head" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#00ff87" />
              <stop offset="100%" stopColor="#00b85f" />
            </radialGradient>
          </defs>
          <circle cx="24" cy="24" r="20" fill="url(#head)" />
          <motion.g
            animate={{ x: [0, 1, -1, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.g
              animate={{ scaleY: blink ? 0.1 : 1 }}
              transition={{ duration: 0.12 }}
              style={{ originY: "22px", transformBox: "fill-box" }}
            >
              <ellipse cx="17" cy="22" rx="2.4" ry="2.4" fill="#0a0a0a" />
              <ellipse cx="31" cy="22" rx="2.4" ry="2.4" fill="#0a0a0a" />
              <circle cx="17.6" cy="21.4" r="0.6" fill="#fff" />
              <circle cx="31.6" cy="21.4" r="0.6" fill="#fff" />
            </motion.g>
            <motion.path
              d="M18 30 Q24 33 30 30"
              fill="none"
              stroke="#0a0a0a"
              strokeWidth="1.6"
              strokeLinecap="round"
              animate={{ y: [0, 2, 0] }}
              transition={{ duration: 3.5, repeat: Infinity }}
            />
          </motion.g>
        </svg>
        <span className="absolute -top-1 -right-1 flex size-3 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-bull" />
        </span>
      </motion.button>
    </div>
  );
}
