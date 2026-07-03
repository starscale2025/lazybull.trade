"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  COPY_BEATS,
  beatOpacity,
  canvasOpacity,
  flashOpacity,
  frameUrl,
  manifestSchema,
  progressToFrame,
  type FrameSet,
} from "@/lib/cinema";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SCROLL_LENGTH_VH = 500;
const EAGER_FRAMES = 24;
const CHUNK = 24;

type Frame = ImageBitmap | HTMLImageElement;

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function ScrollCinema() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  // "cinema" until proven otherwise; flips to static for reduced-motion or load failure
  const [mode, setMode] = useState<"cinema" | "static">("cinema");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!section || !canvas || !ctx) return;

    let disposed = false;
    let st: ScrollTrigger | null = null;
    let set: FrameSet | null = null;
    const frames: (Frame | null)[] = [];
    let progress = 0;
    let lastDrawn = -1;

    const draw = () => {
      if (!set) return;
      const target = progressToFrame(progress, set.frameCount);
      // nearest loaded frame at/below target, else nearest above — never blank
      let idx = target;
      while (idx >= 0 && !frames[idx]) idx--;
      if (idx < 0) {
        idx = target;
        while (idx < set.frameCount && !frames[idx]) idx++;
        if (idx >= set.frameCount) return;
      }
      if (idx === lastDrawn) return;
      lastDrawn = idx;
      const img = frames[idx] as Frame;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / set.width, ch / set.height);
      const dw = set.width * scale;
      const dh = set.height * scale;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const applyOverlays = () => {
      if (stickyRef.current) stickyRef.current.style.opacity = String(canvasOpacity(progress));
      if (flashRef.current) flashRef.current.style.opacity = String(flashOpacity(progress));
      COPY_BEATS.forEach((beat, i) => {
        const el = copyRefs.current[i];
        if (!el) return;
        const o = beatOpacity(progress, beat);
        el.style.opacity = String(o);
        el.style.transform = `translate(-50%, calc(-50% + ${((1 - o) * 14).toFixed(2)}px))`;
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      lastDrawn = -1;
      draw();
    };

    const loadFrame = async (s: FrameSet, i: number) => {
      try {
        const res = await fetch(frameUrl(s.dir, i));
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        frames[i] =
          typeof createImageBitmap === "function"
            ? await createImageBitmap(blob)
            : await blobToImage(blob);
      } catch {
        frames[i] = null;
      }
    };

    (async () => {
      try {
        const res = await fetch("/cinema/frames/manifest.json");
        if (!res.ok) throw new Error(String(res.status));
        const manifest = manifestSchema.parse(await res.json());
        set = window.innerWidth <= 768 ? manifest.mobile : manifest.desktop;
      } catch {
        if (!disposed) setMode("static");
        return;
      }
      frames.length = set.frameCount;
      resize();
      const eager = Math.min(EAGER_FRAMES, set.frameCount);
      await Promise.all(Array.from({ length: eager }, (_, i) => loadFrame(set!, i)));
      if (disposed) return;
      draw();
      // Background-load the rest in chunks; redraw in case the user scrubbed ahead.
      void (async () => {
        for (let start = eager; start < set!.frameCount && !disposed; start += CHUNK) {
          const n = Math.min(CHUNK, set!.frameCount - start);
          await Promise.all(Array.from({ length: n }, (_, j) => loadFrame(set!, start + j)));
          if (!disposed) {
            lastDrawn = -1;
            draw();
          }
        }
      })();
      st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          progress = self.progress;
          draw();
          applyOverlays();
        },
      });
      applyOverlays();
    })();

    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      st?.kill();
      for (const f of frames) {
        if (f && "close" in f) f.close();
      }
    };
  }, []);

  if (mode === "static") {
    // Reduced motion or frames unavailable: calm static hero, copy laid out plainly.
    return (
      <section className="relative overflow-hidden border-b border-border bg-bg">
        <img
          src="/cinema/frames/poster.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-24 text-center">
          {COPY_BEATS.map((b) => (
            <div key={b.id}>
              <div className="font-display text-3xl tracking-tightest text-fg md:text-4xl">{b.heading}</div>
              {b.sub && <div className="mt-2 font-mono text-sm text-fg-dim">{b.sub}</div>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      data-cinema
      className="relative z-20 bg-bg"
      style={{ height: `${SCROLL_LENGTH_VH}vh`, marginBottom: "-100vh" }}
    >
      <div ref={stickyRef} className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className="h-full w-full" />
        {COPY_BEATS.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => { copyRefs.current[i] = el; }}
            className="absolute left-1/2 top-1/2 w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ opacity: 0 }}
          >
            <div className="font-display text-4xl tracking-tightest text-fg md:text-6xl">{b.heading}</div>
            {b.sub && <div className="mt-3 font-mono text-sm text-fg-dim md:text-base">{b.sub}</div>}
          </div>
        ))}
        <div ref={flashRef} className="absolute inset-0 bg-bull" style={{ opacity: 0 }} />
        <noscript>
          <img src="/cinema/frames/poster.webp" alt="LazyBull — options, without the fog" className="absolute inset-0 h-full w-full object-cover" />
        </noscript>
      </div>
    </section>
  );
}
