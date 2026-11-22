"use client";

// The stage of /start: the market as a floor, the wordmark on the horizon, six
// pages circling it. This component measures the stage, owns the page's one
// frame loop (orbit, pointer parallax, dust) and the ways to turn the ring.
//
// What the server sends is already a finished page: the six pods are real
// links in reading order on a still arc (a grid on small screens). The orbit
// starts only once the page is live, wide enough, on screen, and motion is
// neither paused nor reduced; otherwise the arc is where the pods stay.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Bot, CandlestickChart, Dumbbell, Sigma, TrendingUp, type LucideIcon } from "lucide-react";
import { subscribeFrame, useInView } from "@/lib/ambient-clock";
import { reading } from "@/lib/market/heatmap";
import { motion, useMotionPaused } from "@/lib/motion/bus";
import { extremes, pickMovers, wingCapacity, wingPlaces } from "@/lib/start/chips";
import { useFeed } from "@/lib/start/feed";
import { floorView } from "@/lib/start/floor";
import { TAU, arcAngle, depthBand, driftFactor, frontIndex, mixAngle, nextApproach, podAngle, podPose, restAngle, ringFor, stepSpin, turnToFront, type Ring, type Spin } from "@/lib/start/orbit";
import { createDust } from "./dust";
import { MarketFloor } from "./MarketFloor";
import { statusWord } from "./MarketCaption";
import { MoverChips, MoverRow, type Chip, type Mover } from "./MoverChips";
import { TextRing } from "./TextRing";
import css from "./start.module.css";

export type Pod = { href: string; l: string; d: string };

const ICON: Record<string, LucideIcon> = {
  "/learn": BookOpen,
  "/practice": Dumbbell,
  "/trade": TrendingUp,
  "/pro": CandlestickChart,
  "/quant": Bot,
  "/greeks": Sigma,
};

/** The floor's canvas runs this far past each side of the stage (see .floor). */
const BLEED = 24;
/** One turn in eighty seconds when nobody is touching it. */
const CRUISE = TAU / 80;
/** How far the pods drift against the pointer, in px for a pointer at the screen's edge (sideways, up and down). */
const DRIFT = { x: 14, y: 8 };
/** How close, in px from its edge, the pointer has to come for a pod to answer. */
const APPROACH = 120;
/**
 * Four glass candles in two mirrored pairs: a far pair at the edges of the
 * sky, behind the pods and the wordmark, and a near pair over the floor. Their
 * places are in wordmark sizes (out from the middle, up from the horizon), so
 * they keep the scene's shape on any screen. `d` is depth, 0 far and 1 near.
 * Listed left to right; that is also the order they turn red in (see below).
 */
const CANDLES = [
  { side: -1, out: 2.55, up: 0.62, d: 0.3, bob: 8.6 },
  { side: -1, out: 2.45, up: -0.38, d: 0.85, bob: 7.4 },
  { side: 1, out: 2.45, up: -0.38, d: 0.85, bob: 6.9 },
  { side: 1, out: 2.55, up: 0.62, d: 0.3, bob: 9.1 },
];
const candleBox = (d: number) => ({ w: 8 + d * 12, h: 26 + d * 44 });
/** A candle's place as CSS: centred on its point, never off the stage's edge. */
const candlePlace = (c: (typeof CANDLES)[number]) => {
  const { w, h } = candleBox(c.d);
  const x = `calc(50% ${c.side < 0 ? "-" : "+"} var(--fs) * ${c.out} - ${w / 2}px)`;
  return { left: c.side < 0 ? `max(3%, ${x})` : `min(calc(97% - ${w}px), ${x})`, top: `calc(var(--hz) - var(--fs) * ${c.up} - ${h / 2}px)` };
};
const UNIT: Ring = { cx: 0, cy: 0, rx: 1, ry: 1 };

type Geom = { w: number; h: number; horizon: number; fs: number; ring: Ring; bandTop: number };
const sameGeom = (a: Geom | null, b: Geom) =>
  !!a && a.w === b.w && a.h === b.h && a.horizon === b.horizon && a.fs === b.fs && a.bandTop === b.bandTop && a.ring.rx === b.ring.rx && a.ring.ry === b.ring.ry && a.ring.cy === b.ring.cy;

export function StartStage({ pods }: { pods: Pod[] }) {
  const n = pods.length;
  const stage = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLUListElement>(null);
  const word = useRef<HTMLHeadingElement>(null);
  const horizonEl = useRef<HTMLDivElement>(null);
  const dustEl = useRef<HTMLCanvasElement>(null);
  const podEls = useRef<(HTMLLIElement | null)[]>([]);
  /** Each pod's half size at scale 1, measured with the stage. */
  const podHalf = useRef<{ w: number; h: number }[]>([]);
  /** Where a mouse is over the stage, in the viewport's pixels, and when it last moved. */
  const pointerAt = useRef({ x: 0, y: 0, on: false, movedAt: 0 });

  const feed = useFeed();
  const read = useMemo(() => (feed ? reading(feed.moves) : null), [feed]);
  const paused = useMotionPaused();
  const inView = useInView(stage, "240px");
  const [wide, setWide] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [geom, setGeom] = useState<Geom | null>(null);
  const [front, setFront] = useState(Math.floor((n - 1) / 2));
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  /** The pod the pointer has come up to without touching it (lib/start/orbit.ts, nextApproach). */
  const [approached, setApproached] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const live = !!geom && wide && !reduced && !paused && inView;

  // The frame loop reads these; none of them is worth a render per frame.
  const geomRef = useRef<Geom | null>(null);
  geomRef.current = geom;
  const liveRef = useRef(false);
  liveRef.current = live;
  const spin = useRef<Spin>({ angle: restAngle(n), vel: 0, goal: null });
  const blend = useRef(0); // 0 the still arc, 1 the orbit
  const frontRef = useRef(front);
  const approachRef = useRef<number | null>(null);
  const hold = useRef({ hover: false, focus: false, approach: false, until: 0 });
  const drag = useRef({ id: -1, x0: 0, a0: 0, active: false, samples: [] as [number, number][] });
  /** Until when a click is the tail of a drag's release, not a click. */
  const swallowUntil = useRef(0);

  // The still arc, the same on the server and here: each pod's place as numbers the CSS reads.
  const arc = useMemo(
    () =>
      pods.map((_, i) => {
        const theta = arcAngle(i, n);
        const pose = podPose(theta, UNIT);
        return { "--c": Math.cos(theta).toFixed(4), "--s": Math.sin(theta).toFixed(4), "--k": pose.scale.toFixed(3), "--o": pose.opacity.toFixed(3) } as CSSProperties;
      }),
    [pods, n],
  );

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Measure the stage and hand the ring's size back to the CSS, so the still
  // arc and the orbit are one shape.
  const measure = useCallback(() => {
    const s = stage.current;
    const hz = horizonEl.current;
    const wd = word.current;
    const b = band.current;
    if (!s || !hz || !wd || !b) return;
    const w = s.clientWidth;
    const horizon = hz.offsetTop + 1;
    const fontSize = parseFloat(getComputedStyle(wd).fontSize) || 200;
    // the widest pod sets the clearance (pods are as wide as their names)
    const podWidth = Math.max(0, ...podEls.current.map((el) => el?.offsetWidth ?? 0)) || 200;
    podHalf.current = podEls.current.map((el) => ({ w: (el?.offsetWidth ?? 200) / 2, h: (el?.offsetHeight ?? 50) / 2 }));
    const ring = ringFor({ width: w, horizon }, { halfWidth: wd.offsetWidth / 2, fontSize }, { width: podWidth });
    const r1 = (v: number) => Math.round(v * 10) / 10;
    ring.rx = r1(ring.rx);
    ring.ry = r1(ring.ry);
    ring.cy = r1(ring.cy);
    s.style.setProperty("--rx", `${ring.rx}px`);
    s.style.setProperty("--ry", `${ring.ry}px`);
    s.style.setProperty("--cy", `${ring.cy}px`);
    const next: Geom = { w, h: s.clientHeight, horizon, fs: Math.round(fontSize * 10) / 10, ring, bandTop: b.offsetTop };
    setGeom((prev) => (sameGeom(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    if (word.current) ro.observe(word.current);
    const wd = word.current;
    wd?.addEventListener("animationend", measure);
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
      ro.disconnect();
      wd?.removeEventListener("animationend", measure);
    };
  }, [measure]);

  // The letters' answer to how hard the market is moving: Fraunces' WONK and
  // SOFT axes, the mapping lib/wonk.ts uses, tweened here on this wordmark
  // alone so no other page's type moves.
  const heat = read ? Math.round(read.heat * 10) / 10 : 0;
  const heatNow = useRef(0);
  useEffect(() => {
    const el = word.current;
    const write = (v: number) => {
      if (el) el.style.fontVariationSettings = `"WONK" ${v.toFixed(3)}, "SOFT" ${(v * 60).toFixed(1)}`;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      heatNow.current = heat;
      write(heat);
      return;
    }
    const from = heatNow.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      heatNow.current = from + (heat - from) * (1 - Math.pow(1 - k, 5));
      write(heatNow.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [heat]);

  // The floor's view, and the day's movers: the biggest moves on two mirrored
  // wings above the ring, worst to best from left to right. A small screen
  // has room for two, the day's worst and best, in a row along the top.
  const view = useMemo(() => (geom ? floorView(geom.w + BLEED * 2, geom.h, geom.horizon) : null), [geom]);
  const chips = useMemo(() => {
    if (!feed || !geom || !wide) return [] as Chip[];
    const box = { width: geom.w, horizon: geom.horizon, fontSize: geom.fs };
    const movers = pickMovers(feed.moves, wingCapacity(box));
    const places = wingPlaces(movers.length, box);
    return movers.map(([sym, move], i) => ({ sym, move, x: places[i].x, y: places[i].y }));
  }, [feed, geom, wide]);
  const rowMovers = useMemo(() => (feed && !wide ? extremes(feed.moves).map(([sym, move]): Mover => ({ sym, move })) : []), [feed, wide]);

  // The one frame loop. It starts with the pods exactly where the still arc
  // left them, eases them out onto the orbit, and from then on turns the ring.
  useLayoutEffect(() => {
    if (!live) return;
    const s = stage.current;
    const els = podEls.current;
    if (!s) return;
    const ptr = { x: 0, y: 0, wx: 0, wy: 0 };
    const near = new Array<number>(n).fill(0);
    /** How near the pointer is to each pod this frame, before easing: 0 out of reach, 1 touching. */
    const reach = new Array<number>(n).fill(0);
    const dust = dustEl.current ? createDust(dustEl.current) : null;
    let dustFor: Geom | null = null;

    // `rect` is the stage on the screen, read before anything is written this
    // frame (and only while a mouse is over it); `ease` is this frame's share
    // of the way to where the pods' answers are heading.
    const write = (now: number, rect: DOMRect | null = null, ease = 1) => {
      const g = geomRef.current;
      if (!g) return;
      const e = 1 - Math.pow(1 - blend.current, 3);
      const at = pointerAt.current;
      for (let i = 0; i < n; i++) {
        const el = els[i];
        if (!el) continue;
        const onRing = podAngle(i, spin.current.angle, n);
        const pose = podPose(e >= 1 ? onRing : mixAngle(arcAngle(i, n), onRing, e), g.ring);
        // the pods drift against the pointer, the front of the ring a fifth more than the back
        const depthK = driftFactor(pose.depth);
        const x = pose.x - ptr.x * DRIFT.x * depthK;
        const y = pose.y + ptr.y * DRIFT.y * depthK;
        // a pod the pointer comes near answers: it brightens, lifts 3px and takes a faint light
        let target = 0;
        if (rect && at.on) {
          const half = podHalf.current[i] ?? { w: 100, h: 25 };
          const dx = Math.max(0, Math.abs(at.x - (rect.left + x)) - half.w * pose.scale);
          const dy = Math.max(0, Math.abs(at.y - (rect.top + y)) - half.h * pose.scale);
          target = Math.max(0, 1 - Math.hypot(dx, dy) / APPROACH);
        }
        reach[i] = target;
        near[i] += (target - near[i]) * ease;
        if (target === 0 && near[i] < 0.004) near[i] = 0;
        const nv = near[i].toFixed(2);
        if (el.dataset.near !== nv) {
          el.dataset.near = nv;
          el.style.setProperty("--near", nv);
        }
        el.style.transform = `translate3d(${x.toFixed(1)}px,${(y - g.bandTop - near[i] * 3).toFixed(1)}px,0) translate(-50%,-50%) scale(${pose.scale.toFixed(3)})`;
        el.style.opacity = pose.opacity.toFixed(3);
        el.style.zIndex = String(pose.z);
        const band = depthBand(pose.depth);
        if (el.dataset.depth !== band) el.dataset.depth = band;
      }
      const f = frontIndex(spin.current.angle, n);
      if (f !== frontRef.current) {
        frontRef.current = f;
        setFront(f);
      }
      // The pod the pointer has come up to: the bar says what it is for and the
      // ring waits for it, as for a pod under the pointer. Not during a drag.
      const reached = rect && at.on && !drag.current.active ? nextApproach(approachRef.current, reach, now - at.movedAt) : null;
      if (reached !== approachRef.current) {
        if (reached == null) hold.current.until = now + 900;
        approachRef.current = reached;
        hold.current.approach = reached != null;
        setApproached(reached);
      }
    };

    write(performance.now());
    const stop = subscribeFrame((now, dt) => {
      const g = geomRef.current;
      if (!g) return;
      const rect = pointerAt.current.on ? s.getBoundingClientRect() : null;
      // the pointer, eased
      const k = 1 - Math.pow(0.92, dt * 60);
      ptr.x += (motion.pointerX - ptr.x) * k;
      ptr.y += (motion.pointerY - ptr.y) * k;
      if (Math.abs(ptr.x - ptr.wx) > 0.002 || Math.abs(ptr.y - ptr.wy) > 0.002) {
        ptr.wx = ptr.x;
        ptr.wy = ptr.y;
        s.style.setProperty("--px", ptr.x.toFixed(3));
        s.style.setProperty("--py", ptr.y.toFixed(3));
      }
      blend.current = Math.min(1, blend.current + dt / 1.3);
      if (!drag.current.active) {
        const held = hold.current.hover || hold.current.focus || hold.current.approach || now < hold.current.until;
        spin.current = stepSpin(spin.current, dt, { cruise: CRUISE, hold: held });
      }
      write(now, rect, 1 - Math.pow(0.82, dt * 60));
      if (dust) {
        if (dustFor !== g) {
          dust.resize(g.w, g.h, g.horizon);
          dustFor = g;
        }
        dust.step(dt);
      }
    });
    return () => {
      stop();
      dust?.clear();
      for (const el of els) {
        if (!el) continue;
        el.style.transform = "";
        el.style.opacity = "";
        el.style.zIndex = "";
        el.style.removeProperty("--near");
        delete el.dataset.depth;
        delete el.dataset.near;
      }
      s.style.setProperty("--px", "0");
      s.style.setProperty("--py", "0");
      if (approachRef.current != null) setApproached(null);
      approachRef.current = null;
      hold.current.approach = false;
      blend.current = 0;
      spin.current = { angle: restAngle(n), vel: 0, goal: null };
    };
  }, [live, n]);

  // ── turning the ring by hand ───────────────────────────────────────────
  // A drag takes over only after 6px, so a plain click on a pod is still a
  // click; once it has, the click that follows the release is swallowed. That
  // is decided by time, not by a flag: a browser that sends no click after a
  // captured drag must not leave the next real click (or Enter) eaten.
  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!liveRef.current || e.button !== 0) return;
    swallowUntil.current = 0;
    drag.current = { id: e.pointerId, x0: e.clientX, a0: spin.current.angle, active: false, samples: [] };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const g = geomRef.current;
    if (d.id !== e.pointerId || !g) return;
    const dx = e.clientX - d.x0;
    if (!d.active) {
      if (Math.abs(dx) < 6) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    // at the front of the ring a pod moves one ring-radius for each radian
    spin.current = { angle: d.a0 - dx / g.ring.rx, vel: 0, goal: null };
    d.samples.push([performance.now(), spin.current.angle]);
    if (d.samples.length > 6) d.samples.shift();
  };
  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    if (d.active) {
      const first = d.samples[0];
      const last = d.samples[d.samples.length - 1];
      const flick = first && last && last[0] > first[0] ? (last[1] - first[1]) / ((last[0] - first[0]) / 1000) : 0;
      spin.current = { angle: spin.current.angle, vel: Math.max(-4, Math.min(4, flick)), goal: null };
      swallowUntil.current = performance.now() + 350;
      setDragging(false);
    }
    d.id = -1;
    d.active = false;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (performance.now() > swallowUntil.current) return;
    swallowUntil.current = 0;
    e.preventDefault();
    e.stopPropagation();
  };

  const enter = (i: number) => {
    hold.current.hover = true;
    setHovered(i);
  };
  const leave = () => {
    hold.current.hover = false;
    hold.current.until = performance.now() + 900;
    setHovered(null);
  };
  const focus = (e: React.FocusEvent<HTMLAnchorElement>, i: number) => {
    hold.current.focus = true;
    setFocused(i);
    // a pod reached by keyboard comes round to the front, by the short way
    if (liveRef.current && e.currentTarget.matches(":focus-visible")) {
      const a = spin.current.angle;
      spin.current = { angle: a, vel: 0, goal: a + turnToFront(i, a, n) };
    }
  };
  const blur = () => {
    hold.current.focus = false;
    hold.current.until = performance.now() + 900;
    setFocused(null);
  };
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
    podEls.current[next]?.querySelector("a")?.focus();
  };

  // The candles' colours are the day's: as many of the four are red as the
  // share of stocks that fell, filled from the left like the movers' wings.
  // Before the first quote, none is red: red is never decoration.
  const reds = read ? Math.round((CANDLES.length * read.down) / Math.max(1, read.up + read.down)) : 0;
  const shown = focused ?? hovered ?? approached ?? (live ? front : null);
  // the pod in hand (focused, under the pointer, or approached by it) also says what it is for
  const inHand = focused != null || hovered != null || approached != null;
  const still = reduced || paused;

  return (
    <div
      ref={stage}
      className={css.stage}
      data-start="stage"
      data-live={live || undefined}
      data-dragging={dragging || undefined}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const at = pointerAt.current;
        at.x = e.clientX;
        at.y = e.clientY;
        at.on = true;
        at.movedAt = performance.now();
      }}
      onPointerLeave={() => {
        pointerAt.current.on = false;
      }}
    >
      <div aria-hidden className={css.aura} />
      <TextRing />
      <div aria-hidden className={css.horizonGlow} />
      <MarketFloor view={view} feed={feed} still={still} />
      <div aria-hidden className={css.pool} />
      <div ref={horizonEl} aria-hidden className={css.horizon} data-start="horizon" />
      <div className={css.wordClip}>
        <h1 ref={word} id="start-title" className={css.word} data-start="word" data-state={feed?.state}>
          <span aria-hidden>
            lazybull
            <span className={css.dot}>
              .
            </span>
          </span>
          <span className="sr-only">lazybull: where to?</span>
        </h1>
      </div>

      <nav aria-label="Main pages">
        <ul
          ref={band}
          className={css.band}
          data-start="band"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          {pods.map((p, i) => {
            const Icon = ICON[p.href] ?? TrendingUp;
            return (
              <li
                key={p.href}
                ref={(el) => {
                  podEls.current[i] = el;
                }}
                className={css.pod}
                data-start="pod"
                data-hot={shown === i || undefined}
                style={arc[i]}
                onPointerEnter={(e) => e.pointerType === "mouse" && enter(i)}
                onPointerLeave={(e) => e.pointerType === "mouse" && leave()}
              >
                <Link href={p.href} draggable={false} className={css.podLink} onFocus={(e) => focus(e, i)} onBlur={blur} onKeyDown={(e) => onKeyDown(e, i)}>
                  <Icon size={18} aria-hidden className={css.podIcon} />
                  <span className={css.podName} data-start="pod-name">
                    {p.l}
                  </span>
                  <span className="sr-only">: {p.d}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {wide ? <MoverChips chips={chips} sim={feed?.state === "sim"} /> : <MoverRow movers={rowMovers} sim={feed?.state === "sim"} />}
      {CANDLES.map((c, i) => (
        <i
          key={i}
          aria-hidden
          data-start="candle"
          data-tone={i < reds ? "down" : "up"}
          className={css.candle}
          style={{ ...candlePlace(c), zIndex: c.d < 0.5 ? 5 : 17, "--d": c.d, "--tone": i < reds ? "#ff2e63" : "#00ff87" } as CSSProperties}
        >
          <i className={css.candleBody} style={{ "--bob": `${c.bob}s`, animationDelay: `${-c.bob * c.d}s` } as CSSProperties} />
        </i>
      ))}
      <canvas ref={dustEl} aria-hidden className={css.dust} />

      <div className={css.bar}>
        <div className={css.barInner}>
          <p className={css.barStatus} data-start="status">
            <span aria-hidden className={css.statusDot} data-state={feed?.state} />
            {statusWord(feed)}
          </p>
          {/* Where the pod at the front, or the one in hand, leads. Decoration: each link already says this to a screen reader. */}
          <p aria-hidden className={css.barSay} data-start="say" data-hand={inHand || undefined}>
            {shown != null && (
              <span key={shown} className={css.captionSwap}>
                <span className={css.sayName}>{pods[shown].l}</span>
                {inHand && <span className={css.sayText}>{pods[shown].d}</span>}
              </span>
            )}
          </p>
          <p className={css.barEnd}>
            {read && (
              <span>
                <span className={css.up}>{read.up} up</span> · <span className={css.down}>{read.down} down</span>
              </span>
            )}
            <a href="#index" className={css.barLink}>
              Full index ↓
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
