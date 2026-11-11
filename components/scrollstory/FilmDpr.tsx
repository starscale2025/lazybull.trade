"use client";

import { useEffect, useState } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import { cinemaClock } from "@/lib/cinema-clock";

/** The most pixels per CSS pixel a film layer draws (Gate A4 #2). */
export const FILM_DPR_MAX = 1.5;

/**
 * The candles' ceiling on a high-refresh screen (Stage 2, F5, the owner's
 * pick). At 1.5x the glass misses a 120 Hz frame now and then and shows it at
 * 60; at 1.25x it holds 120 throughout, and the difference in sharpness is a
 * hair on the ring and the candle edges. 60 Hz screens keep 1.5x.
 */
export const FILM_DPR_HIGH_REFRESH = 1.25;

const topFor = (max: number) => (typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, max));

let refreshProbe: Promise<number> | null = null;
/** The screen's refresh rate in Hz, measured once per page over 40 frames.
 *  It runs while the film mounts, when frames are being dropped, so it reads
 *  the SHORTEST gap, not the typical one: frame times land on whole multiples
 *  of the screen's refresh interval, and any two frames on consecutive
 *  refreshes show it. (The median read a 120 Hz screen as 60 here.) */
function measureRefresh(): Promise<number> {
  refreshProbe ??= new Promise((resolve) => {
    let last = 0;
    let shortest = Infinity;
    let n = 0;
    const step = (ts: number) => {
      if (last) {
        const gap = ts - last;
        if (gap > 4 && gap < shortest) shortest = gap; // under 4 ms is timer jitter, not a refresh
      }
      last = ts;
      if (++n < 41) requestAnimationFrame(step);
      else resolve(Number.isFinite(shortest) ? 1000 / shortest : 60);
    };
    requestAnimationFrame(step);
  });
  return refreshProbe;
}

/**
 * A film layer's pixel ratio, held in ONE place (Stage 2, F1).
 *
 * The layer's <Canvas> used to get dpr={[1, max]} while a governor inside it
 * called setDpr. Every re-render of the layer handed the canvas its range
 * again and three reset it to the top, undoing the governor mid-act: a
 * 110 ms freeze at film 0.355 and a sharpness pop at 0.705. Now the layer
 * keeps the number in React state and passes the canvas exactly that number,
 * and the governor inside the canvas is the only thing that changes it.
 *
 * And it changes it at most ONCE, and only down (F4). Every change resizes
 * the canvas and reallocates the composer's targets, a 30–40 ms frame of its
 * own and a visible change in sharpness. The old flip-flop dropped both
 * layers to 1x at the pour and raised them again by film 0.5: two pops each,
 * in the middle of an act. A device that cannot hold the top steps down once
 * and stays there for the session.
 *
 *
 * A layer may also name a lower ceiling for screens above 90 Hz. It applies
 * once the refresh rate is known and only while the film is still before the
 * point where the layer can first be seen (`hiddenUntil`, film progress), so
 * it lands behind the curtain, never in the middle of an act. (Not "until
 * the layer is active": the film runs every layer for a few frames under
 * frame zero's curtain to warm it, before anyone can see it.)
 *
 *   const { dpr, governor } = useFilmDpr(max, { highRefreshMax, hiddenUntil });
 *   <Canvas dpr={dpr}> …scene… {governor} </Canvas>
 */
export function useFilmDpr(
  max = FILM_DPR_MAX,
  { highRefreshMax, hiddenUntil = 0 }: { highRefreshMax?: number; hiddenUntil?: number } = {}
) {
  const [dpr, setDpr] = useState(() => topFor(max));
  useEffect(() => {
    if (highRefreshMax === undefined || highRefreshMax >= max) return;
    let gone = false;
    measureRefresh().then((hz) => {
      if (gone || hz <= 90 || cinemaClock.progress >= hiddenUntil) return;
      setDpr((d) => Math.min(d, topFor(highRefreshMax)));
    });
    return () => {
      gone = true;
    };
  }, [highRefreshMax, hiddenUntil, max]);
  return { dpr, governor: <FilmDpr dpr={dpr} onStep={setDpr} /> };
}

function FilmDpr({ dpr, onStep }: { dpr: number; onStep: (dpr: number) => void }) {
  const down = () => {
    if (dpr > 1) onStep(1);
  };
  return <PerformanceMonitor onDecline={down} onFallback={down} />;
}
