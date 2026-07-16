# Cinematic Materials Makeover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Higgsfield generation tasks (1, 2, 4–7, 10) MUST run in the main session (MCP tools live there), not in subagents.

**Goal:** Inject photoreal, tactile, cinematic matter — generated with Higgsfield — into LazyBull's currently all-vector neon design, so every page reads like a product film instead of a terminal demo.

**Architecture:** Keep the existing design system (terminal dark `#050505`, bull green `#00ff87`, Fraunces display / JetBrains mono, GsapScroller reveal kit) and layer photoreal assets INTO it: a real obsidian bull statue (stills + a new GLB that also removes our CC-BY license debt), one "prop scene" hero per page with giant type sandwiched around the object, glyph-rain particle curtains hanging from heroes, physics-hung feature cards, and one ambient video loop. All assets are generated once via the Higgsfield MCP, downloaded into `public/media/`, and committed — the site never calls Higgsfield at runtime.

**Tech Stack:** Next.js 16 / React 19 / Tailwind 4 (existing), GSAP ScrollTrigger via `data-gsap` (existing), Higgsfield MCP (`generate_image` nano_banana_pro · `remove_background` · `upscale_image` · `generate_3d` image_to_3d · `generate_video` kling3_0_turbo), `cwebp` + `sips` for asset finishing, Playwright for visual verification.

---

## Reference DNA (what the six reels demand)

| Reel | Technique observed | Where it lands in LazyBull |
|---|---|---|
| r1 — "portfolios that hook" (heatbureau, kargo, barbiana) | Giant editorial type + REAL imagery; sliced galleries | Every interior hero: `MaterialHero` type-sandwich |
| r2 — Buterine travel | Photoreal 3D artifact floating on textured paper, **glyph curtains raining from the object** | `ParticleCurtain` under each hero object |
| r3/r4 — Alto perfume | Surreal tactile prop scenes: product balanced on stone, wrapped in fabric, ringed by a fish, label on wet skin | One prop-scene still per page (obsidian chip, prism, brass machine) |
| r5 — motion design | Pill cards hanging on wires, pendulum physics, glow | `HungCard` feature chips |
| r6 — watch site + macro eye | Type interleaved BEHIND/IN FRONT of a floating photoreal object; particle streams orbiting product; **macro eye with HUD tracking boxes** | Type-sandwich hero; the AI-vision "eye" section |

**Asset budget discipline:** the Higgsfield sub is Standard — every generation step preflights with `get_cost: true`, uses `count: 2` (not 4), and upscales only the selected winner. Target ≤ ~25 generations total for the whole plan.

**Performance budget (hard):** each hero still ≤ 300 KB (1600 px WebP q80) + a 800 px mobile variant ≤ 90 KB; cutout PNGs → WebP with alpha ≤ 350 KB; the single video loop ≤ 2.5 MB WebM; every `<img>` below the fold `loading="lazy"`; reduced-motion disables the loop and curtains.

---

### Task 0: Asset workspace + finishing script

**Files:**
- Create: `public/media/README.md`
- Create: `scripts/media/finish.mjs`

- [ ] **Step 1: Create the media directory contract**

```bash
mkdir -p public/media/{bull,trade,learn,quant,eye,loops}
```

Write `public/media/README.md`:

```markdown
# Generated media (Higgsfield)

All files here are AI-generated via Higgsfield (account-licensed), generated
once and committed — the site never calls Higgsfield at runtime.

Naming: <subject>-<variant>@<width>.webp  (e.g. bull-hero@1600.webp)
Cutouts (alpha): <subject>-cut@<width>.webp
Loops: <subject>-loop.webm (≤2.5MB, muted, loop, playsinline)

Budgets: stills ≤300KB @1600w, mobile ≤90KB @800w, cutouts ≤350KB.
Regeneration prompts live in docs/superpowers/plans/2026-07-14-cinematic-materials-makeover.md.
```

- [ ] **Step 2: Write the finishing script** (downscale + WebP both sizes + report)

Create `scripts/media/finish.mjs`:

```js
// Finish a downloaded master image into committed site assets:
//   node scripts/media/finish.mjs <master.(png|jpg|webp)> public/media/<dir>/<name>
// Emits <name>@1600.webp and <name>@800.webp and prints sizes.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [src, outBase] = process.argv.slice(2);
if (!src || !outBase) {
  console.error("usage: node scripts/media/finish.mjs <master> <outBaseNoExt>");
  process.exit(1);
}
const tmp = `${outBase}.tmp.png`;
for (const w of [1600, 800]) {
  execFileSync("sips", ["-Z", String(w), "-s", "format", "png", src, "--out", tmp], { stdio: "ignore" });
  const out = `${outBase}@${w}.webp`;
  execFileSync("cwebp", ["-quiet", "-q", "82", tmp, "-o", out]);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${path.basename(out)}  ${kb}KB${kb > (w === 1600 ? 300 : 90) ? "  ⚠ OVER BUDGET" : ""}`);
}
fs.rmSync(tmp, { force: true });
```

- [ ] **Step 3: Verify the script runs against any existing image**

Run: `node scripts/media/finish.mjs public/cinema/shots/hero.webp public/media/bull/smoke-test && rm public/media/bull/smoke-test@*.webp`
Expected: two lines printing `smoke-test@1600.webp …KB` and `smoke-test@800.webp …KB`, no crash.

- [ ] **Step 4: Commit**

```bash
git add public/media/README.md scripts/media/finish.mjs
git commit -m "chore(media): generated-asset workspace + finishing script"
```

---

### Task 1: The Bull — hero stills (Higgsfield)

The brand object of the whole makeover. One statue, photographed like the Alto perfume bottle.

**Files:**
- Create: `public/media/bull/bull-hero@1600.webp`, `bull-hero@800.webp`
- Create: `public/media/bull/bull-cut@1600.webp` (alpha cutout for the type-sandwich)

- [ ] **Step 1: Preflight cost** — `generate_image` with `params.get_cost: true`, model `nano_banana_pro`, `count: 2`. Confirm affordable before proceeding.

- [ ] **Step 2: Generate the statue** — `generate_image`, model `nano_banana_pro`, `aspect_ratio: "4:5"`, `count: 2`, prompt:

```
Museum-grade obsidian sculpture of a charging bull, carved from dark volcanic
glass with razor-sharp facets, head lowered mid-charge, standing on a circular
brushed-bronze plinth. Studio product photography on a pure black background,
single hard rim light in emerald green (#00ff87) raking from the upper left,
faint cyan kick light from the right, micro-scratches and dust on the plinth,
85mm lens, f/8, hyper-detailed, centered single object, no text.
```

- [ ] **Step 3: Select the winner** — view both results (`job_display` / `show_generations`), pick the one with the cleanest silhouette (unbroken outline matters for the cutout). If both have broken silhouettes or mushy facets, regenerate ONCE with "full body in frame, complete silhouette, sharp faceted geometry" appended — do not loop beyond one retry.

- [ ] **Step 4: Upscale the winner** — `upscale_image` `resolution: "4k"` with the winner's job id and its width/height.

- [ ] **Step 5: Download + finish** — take the upscaled result URL and run:

```bash
curl -sL "<result_url>" -o /tmp/bull-master.png
node scripts/media/finish.mjs /tmp/bull-master.png public/media/bull/bull-hero
```

Expected: `bull-hero@1600.webp ≤300KB`, `bull-hero@800.webp ≤90KB`.

- [ ] **Step 6: Cutout for the type-sandwich** — `remove_background` on the upscaled job id, download, then:

```bash
sips -Z 1600 -s format png /tmp/bull-cut.png --out /tmp/bull-cut-1600.png
cwebp -quiet -q 84 -exact /tmp/bull-cut-1600.png -o public/media/bull/bull-cut@1600.webp
ls -la public/media/bull/
```

Expected: `bull-cut@1600.webp` ≤350KB with transparency preserved.

- [ ] **Step 7: Commit**

```bash
git add public/media/bull
git commit -m "feat(media): obsidian bull hero stills + alpha cutout (Higgsfield)"
```

---### Task 2: The Bull — real 3D model (replaces the CC-BY GLB)

**Files:**
- Create: `public/models/bull-obsidian.glb`
- Modify: `components/scrollstory/Bull3D.tsx` (MODEL path + license comment + material tune)
- Modify: `public/models/CREDITS.md`

- [ ] **Step 1: Generate the mesh** — `generate_3d`, model `image_to_3d`, media role `image` = Task 1's winning job id, enable texturing + PBR (inspect exact param names via `models_explore(type:'3d')` first). Preflight with `get_cost: true`.

- [ ] **Step 2: Download + inspect the GLB**

```bash
curl -sL "<glb_url>" -o public/models/bull-obsidian.glb
node -e 'const b=require("fs").readFileSync("public/models/bull-obsidian.glb");const j=JSON.parse(b.slice(20,20+b.readUInt32LE(12)).toString("utf8"));let t=0;(j.meshes||[]).forEach(m=>m.primitives.forEach(p=>{const a=j.accessors[p.indices];if(a)t+=a.count/3}));console.log("meshes",j.meshes.length,"tris",t,"mats",(j.materials||[]).length,"imgs",(j.images||[]).length)'
```

Expected: 1+ mesh, 20k–300k tris, textured. If >300k tris, note it — the fit code handles any size but flag for a later decimation pass.

- [ ] **Step 3: Swap the model into the cinema** — in `components/scrollstory/Bull3D.tsx` change:

```tsx
// Model: generated with Higgsfield (image_to_3d from our own obsidian-bull
// still) — owned output, no attribution requirements. See public/models/CREDITS.md.
const MODEL = "/models/bull-obsidian.glb";
```

Because this mesh ships REAL PBR textures (the old one had none), the blanket
material override must become conditional. In the `fitted` useMemo, replace the
final traverse with:

```tsx
    // The generated mesh ships its own PBR textures — keep them, and add the
    // brand fresnel rim on top instead of replacing the material wholesale.
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const base = m.material as THREE.MeshStandardMaterial;
      if (base?.isMeshStandardMaterial) {
        base.onBeforeCompile = mat.onBeforeCompile; // same rim shader chunk
        base.customProgramCacheKey = () => "bull-fresnel";
        base.needsUpdate = true;
      } else {
        m.material = mat; // fallback: untextured primitive → our sculpture material
      }
    });
```

- [ ] **Step 4: Verify in isolation** — recreate the temporary `app/bull-test/page.tsx` harness from git history (`git log --oneline --all -- app/bull-test` → checkout that file temporarily), run the dev server, capture with Playwright at `#0.78`, READ the screenshot: statue framed horns-to-hooves, textures visible, rim reading. Refit `s = 2.6 / size.y` and camera if the new proportions crop. Delete the harness after.

- [ ] **Step 5: Update credits** — rewrite `public/models/CREDITS.md`:

```markdown
# 3D model credits

## bull-obsidian.glb
Generated via Higgsfield image_to_3d from our own generated still (Task 1,
2026-07-14 plan). Account-licensed output — no third-party attribution required.

## bull.glb (retired)
"Bull" by Poly by Google, CC BY 3.0 — no longer rendered anywhere. Kept only
for git history; safe to delete.
```

- [ ] **Step 6: Run checks + commit**

Run: `npx tsc --noEmit && npx vitest run` — expected clean / 32 passed.

```bash
git add public/models components/scrollstory/Bull3D.tsx
git commit -m "feat(cinema): Higgsfield-generated obsidian bull GLB — owned asset, CC-BY debt retired"
```

---

### Task 3: `MaterialHero` — the type-sandwich component

The reel-6 watch effect: giant display type, with the object floating BETWEEN
text layers (some words behind it, some in front), parallaxing at different rates.

**Files:**
- Create: `components/atmosphere/MaterialHero.tsx`
- Test: `__tests__/material-hero.test.ts`

- [ ] **Step 1: Write the failing test** (the line-splitting helper is pure — TDD it)

Create `__tests__/material-hero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitLayers } from "@/components/atmosphere/MaterialHero";

describe("splitLayers", () => {
  it("splits lines into behind/front by the marker index", () => {
    const r = splitLayers(["THE", "TIMELESS", "AUTOMATIC", "WATCH"], 2);
    expect(r.behind).toEqual(["THE", "TIMELESS"]);
    expect(r.front).toEqual(["AUTOMATIC", "WATCH"]);
  });
  it("clamps out-of-range markers", () => {
    expect(splitLayers(["A", "B"], 99).front).toEqual([]);
    expect(splitLayers(["A", "B"], 0).behind).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify failure** — `npx vitest run __tests__/material-hero.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `components/atmosphere/MaterialHero.tsx`:

```tsx
"use client";

// The type-sandwich hero (reel-6 watch effect): giant display lines render in
// two stacks — `behind` lines sit under the object cutout, `front` lines over
// it — and the three layers parallax at different rates via data-gsap so the
// object reads as physically floating inside the typography.

import Image from "next/image";

export function splitLayers(lines: string[], frontFrom: number) {
  const cut = Math.max(0, Math.min(lines.length, frontFrom));
  return { behind: lines.slice(0, cut), front: lines.slice(cut) };
}

type Props = {
  /** Alpha-cutout image (public path, e.g. /media/bull/bull-cut@1600.webp) */
  cutout: string;
  cutoutAlt: string;
  /** Display lines, top to bottom. */
  lines: string[];
  /** Index of the first line that renders IN FRONT of the object. */
  frontFrom: number;
  kicker?: string;
  className?: string;
};

export function MaterialHero({ cutout, cutoutAlt, lines, frontFrom, kicker, className = "" }: Props) {
  const { behind, front } = splitLayers(lines, frontFrom);
  const Line = ({ text }: { text: string }) => (
    <div className="font-display uppercase leading-[0.92] tracking-tightest text-fg text-[clamp(3rem,9vw,9rem)]">
      {text}
    </div>
  );
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {kicker && (
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint" data-gsap="fade-up">
          ⟢ {kicker}
        </div>
      )}
      <div className="relative">
        {/* behind layer */}
        <div className="relative z-0 select-none" data-gsap="parallax" data-gsap-amount="40">
          {behind.map((t) => <Line key={t} text={t} />)}
        </div>
        {/* the object */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[min(58vw,540px)] -translate-x-1/2 -translate-y-1/2"
          data-gsap="parallax"
          data-gsap-amount="110"
        >
          <Image
            src={cutout}
            alt={cutoutAlt}
            width={1600}
            height={2000}
            priority
            className="h-auto w-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.75)]"
          />
        </div>
        {/* front layer */}
        <div className="relative z-20 select-none" data-gsap="parallax" data-gsap-amount="70">
          {front.map((t) => <Line key={t} text={t} />)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests** — `npx vitest run __tests__/material-hero.test.ts` → 2 passed. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add components/atmosphere/MaterialHero.tsx __tests__/material-hero.test.ts
git commit -m "feat(atmosphere): MaterialHero type-sandwich component"
```

---

### Task 4: `/trade` prop scene — the obsidian chip

Alto-style prop scene: the "bet" as a physical object.

**Files:**
- Create: `public/media/trade/chip-hero@1600.webp`, `chip-hero@800.webp`
- Modify: `app/trade/page.tsx` (header section only)

- [ ] **Step 1: Generate** — `generate_image`, `nano_banana_pro`, `aspect_ratio: "16:9"`, `count: 2`, `get_cost` preflight first, prompt:

```
A single black obsidian casino chip standing on its edge on a wet black slate
surface, razor-thin emerald green (#00ff87) light seam glowing around the chip's
rim, shallow puddle reflecting the glow, macro product photography, black
background with faint green haze, 100mm macro lens, extreme detail, no text.
```

- [ ] **Step 2: Select, upscale, download, finish** — same flow as Task 1 Steps 3–5, output base `public/media/trade/chip-hero`. Verify budgets with the script output.

- [ ] **Step 3: Integrate as the header backdrop** — in `app/trade/page.tsx`, inside the header `<section className="relative overflow-hidden border-b border-border bg-bg">`, add ABOVE the existing `bg-grid` div:

```tsx
        <img
          src="/media/trade/chip-hero@1600.webp"
          srcSet="/media/trade/chip-hero@800.webp 800w, /media/trade/chip-hero@1600.webp 1600w"
          sizes="100vw"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-[0.32]"
          style={{ maskImage: "linear-gradient(to left, black 30%, transparent 78%)" }}
        />
```

(The mask keeps the left side clean for the headline; the chip glows on the right.)

- [ ] **Step 4: Verify** — Playwright screenshot of `/trade` at 1440×900, READ it: chip visible right, headline legible, no layout shift. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add public/media/trade app/trade/page.tsx
git commit -m "feat(trade): obsidian-chip prop scene in the header (Higgsfield)"
```

---

### Task 5: `/learn` hero — glass prism refracting a chart + MaterialHero

**Files:**
- Create: `public/media/learn/prism-hero@1600.webp`, `prism-hero@800.webp`, `prism-cut@1600.webp`
- Modify: `app/learn/page.tsx` (hero region only — READ the file first; it is 1,193 lines and its hero currently opens with the "Trading, visualized." spread)

- [ ] **Step 1: Generate** — `nano_banana_pro`, `aspect_ratio: "4:5"`, `count: 2`, preflight, prompt:

```
A tall glass triangular prism standing on a dark desk, a beam of white light
entering one face and splitting inside into a glowing green candlestick chart
pattern projected through the glass, dust motes in the beam, black studio
background, cinematic macro photography, refraction caustics, extreme detail,
no text.
```

- [ ] **Step 2: Select, upscale, download, finish** → `public/media/learn/prism-hero`, then `remove_background` on the winner → `prism-cut@1600.webp` (same cwebp -exact flow as Task 1 Step 6).

- [ ] **Step 3: Integrate** — READ `app/learn/page.tsx` hero region, then place a `MaterialHero` directly under the page's ticker/nav, BEFORE the existing "Trading, visualized." block:

```tsx
import { MaterialHero } from "@/components/atmosphere/MaterialHero";
```

```tsx
      <MaterialHero
        className="mx-auto max-w-[1400px] px-5 pt-10"
        kicker="learn · 8 min · all live"
        cutout="/media/learn/prism-cut@1600.webp"
        cutoutAlt="Glass prism splitting light into a candlestick chart"
        lines={["TRADING", "TAUGHT BY", "LIGHT"]}
        frontFrom={2}
      />
```

Keep the existing hero copy below it (the stats cards 27/13/8 stay). If the page already opens with a full-screen hero that visually fights this, integrate the cutout INTO the existing hero instead (object between its existing headline lines) — same component, decision made on visual review.

- [ ] **Step 4: Verify** — Playwright screenshot of `/learn` top, READ it: prism floats between "TAUGHT BY" (behind) and "LIGHT" (front), parallax attributes present. tsc clean.

- [ ] **Step 5: Commit**

```bash
git add public/media/learn app/learn/page.tsx
git commit -m "feat(learn): prism type-sandwich hero (Higgsfield)"
```

---

### Task 6: `/quant` hero — the brass calculating machine

**Files:**
- Create: `public/media/quant/machine-hero@1600.webp`, `machine-hero@800.webp`
- Modify: `app/quant/page.tsx` (it is a 21-line wrapper — READ it, the real UI lives in `components/quant/`; integrate the backdrop at the wrapper level)

- [ ] **Step 1: Generate** — `nano_banana_pro`, `aspect_ratio: "16:9"`, `count: 2`, preflight, prompt:

```
An antique brass mechanical calculating machine with exposed gears and number
wheels, mid-computation, one thin emerald green (#00ff87) laser line scanning
across its dials, on a black leather desk mat, dark room, single warm key light
plus green rim, cinematic macro photography, extreme mechanical detail, no text.
```

- [ ] **Step 2: Select, upscale, download, finish** → `public/media/quant/machine-hero`.

- [ ] **Step 3: Integrate** — same masked-backdrop pattern as Task 4 Step 3, placed in the quant page's top section (right-aligned object, left-masked for copy), `opacity-[0.28]`.

- [ ] **Step 4: Verify + commit**

Playwright `/quant` screenshot READ; tsc clean; then:

```bash
git add public/media/quant app/quant/page.tsx
git commit -m "feat(quant): brass-machine prop scene backdrop (Higgsfield)"
```

---

### Task 7: The AI eye — macro + HUD section (homepage `GetStarted` upgrade)

Reel 6's "after:" shot — a macro eye with tracked HUD boxes = "the AI that watches the market."

**Files:**
- Create: `public/media/eye/eye-hero@1600.webp`, `eye-hero@800.webp`
- Modify: `components/GetStarted.tsx`

- [ ] **Step 1: Generate** — `nano_banana_pro`, `aspect_ratio: "16:9"`, `count: 2`, preflight, prompt:

```
Extreme macro photograph of a human eye, iris in cold steel blue with storm
cloud texture, a faint green candlestick chart reflected across the cornea,
wet lashes, dramatic side light, photorealistic skin micro-detail, dark moody
grade, no text, no watermark.
```

- [ ] **Step 2: Select, upscale, download, finish** → `public/media/eye/eye-hero`.

- [ ] **Step 3: Add the section to `GetStarted.tsx`** — insert between the feature `<ul>` and the closing content div, an aside band:

```tsx
        {/* the AI that watches — macro eye with live HUD tracking boxes */}
        <div className="relative mt-14 w-full max-w-3xl overflow-hidden border border-border" data-gsap="scale-in">
          <img
            src="/media/eye/eye-hero@1600.webp"
            srcSet="/media/eye/eye-hero@800.webp 800w, /media/eye/eye-hero@1600.webp 1600w"
            sizes="(max-width: 768px) 100vw, 768px"
            alt="Macro eye with market reflections — the AI watches every tick"
            loading="lazy"
            className="h-auto w-full opacity-90"
          />
          {/* HUD boxes — pure CSS, breathing */}
          {[
            { l: "18%", t: "30%", w: 90, label: "P(down) 71%" },
            { l: "58%", t: "22%", w: 74, label: "IV 0.41" },
            { l: "70%", t: "58%", w: 84, label: "Δ −0.32" },
          ].map((b) => (
            <div
              key={b.label}
              className="pointer-events-none absolute border border-bull/70 bg-bull/5 px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-bull"
              style={{ left: b.l, top: b.t, width: b.w, animation: "gs-hud 3.2s ease-in-out infinite" }}
            >
              {b.label}
            </div>
          ))}
          <div className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim">
            27 bots watching, so you don't have to
          </div>
        </div>
```

And append to the existing inline `<style>` block:

```css
        @keyframes gs-hud { 0%,100% { opacity: 0.55; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) { [style*="gs-hud"] { animation: none; } }
```

- [ ] **Step 4: Re-capture the reveal target** — the cinema resolves into a baked screenshot of this section, so it MUST be re-captured: `npm run cinema:capture` (dev server running), verify `public/cinema/shots/hero.webp` now shows the eye band.

- [ ] **Step 5: Verify + commit**

Playwright `/` scrolled to Get Started, READ: eye band + HUD boxes render; cinema handoff still seamless. Then:

```bash
git add public/media/eye components/GetStarted.tsx public/cinema/shots/hero.webp
git commit -m "feat(home): macro-eye AI section with HUD tracking (Higgsfield)"
```

---

### Task 8: `ParticleCurtain` — glyph rain hanging from heroes (Buterine effect)

**Files:**
- Create: `components/atmosphere/ParticleCurtain.tsx`
- Test: `__tests__/particle-curtain.test.ts`
- Modify: `app/learn/page.tsx` (attach under the MaterialHero object)

- [ ] **Step 1: Write the failing test** for the deterministic column generator:

Create `__tests__/particle-curtain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildColumns } from "@/components/atmosphere/ParticleCurtain";

describe("buildColumns", () => {
  it("is deterministic for a given seed", () => {
    const a = buildColumns(12, 7);
    const b = buildColumns(12, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
  });
  it("keeps phase and speed in sane ranges", () => {
    for (const c of buildColumns(40, 3)) {
      expect(c.phase).toBeGreaterThanOrEqual(0);
      expect(c.phase).toBeLessThan(1);
      expect(c.speed).toBeGreaterThan(0.2);
      expect(c.speed).toBeLessThan(1.61);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run __tests__/particle-curtain.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Create `components/atmosphere/ParticleCurtain.tsx`:

```tsx
"use client";

// Buterine-reel effect: a curtain of glyphs raining from beneath a hero
// object, drawn on a lightweight canvas. Deterministic per seed; time-driven;
// pauses off-screen via IntersectionObserver; disabled for reduced motion.

import { useEffect, useRef } from "react";

const GLYPHS = "01↑↓$ΔΘΓν%◦·";

export function buildColumns(count: number, seed: number) {
  let a = seed | 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    x: (i + 0.5) / count,
    phase: rnd(),
    speed: 0.25 + rnd() * 1.35,
    len: 6 + Math.floor(rnd() * 14),
  }));
}

export function ParticleCurtain({ height = 260, seed = 7, className = "" }: { height?: number; seed?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = false;
    const cols = buildColumns(Math.max(8, Math.floor(canvas.clientWidth / 22)), seed);
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    const draw = (ts: number) => {
      if (!running) return;
      const t = ts / 1000;
      const W = canvas.clientWidth;
      ctx.clearRect(0, 0, W, height);
      ctx.font = "11px ui-monospace, monospace";
      for (const c of cols) {
        const head = ((c.phase + t * c.speed * 0.12) % 1) * (height + 140) - 70;
        for (let k = 0; k < c.len; k++) {
          const y = head - k * 14;
          if (y < 0 || y > height) continue;
          const fade = (1 - k / c.len) * (1 - y / height) * 0.85;
          ctx.fillStyle = `rgba(0,255,135,${Math.max(0, fade * 0.6)})`;
          ctx.fillText(GLYPHS[(c.len * 7 + k * 3 + ((c.phase * 97) | 0)) % GLYPHS.length], c.x * W, y);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [height, seed]);
  return <canvas ref={ref} aria-hidden className={`pointer-events-none block w-full ${className}`} style={{ height }} />;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run` → all pass (34 total). `npx tsc --noEmit` clean.

- [ ] **Step 5: Attach under the `/learn` hero** — directly below the `<MaterialHero …/>` from Task 5:

```tsx
      <ParticleCurtain className="mx-auto -mt-6 max-w-[900px]" height={220} seed={7} />
```

with import `import { ParticleCurtain } from "@/components/atmosphere/ParticleCurtain";`

- [ ] **Step 6: Verify + commit**

Playwright `/learn`, READ: glyph rain visible beneath the prism. Then:

```bash
git add components/atmosphere/ParticleCurtain.tsx __tests__/particle-curtain.test.ts app/learn/page.tsx
git commit -m "feat(atmosphere): glyph particle curtain + learn hero attachment"
```

---

### Task 9: `HungCard` — physics-hung feature chips (reel-5 pendulum)

**Files:**
- Create: `components/atmosphere/HungCard.tsx`
- Modify: `components/GetStarted.tsx` (feature strip becomes hung cards)

- [ ] **Step 1: Implement the component** (visual physics — no unit test; verified visually)

Create `components/atmosphere/HungCard.tsx`:

```tsx
"use client";

// Reel-5 motion language: a pill card hanging from a thin wire, swaying with a
// damped pendulum. Sway is idle-animated; hovering gives it a push.

import { useEffect, useRef, type ReactNode } from "react";

export function HungCard({ children, wire = 56, phase = 0 }: { children: ReactNode; wire?: number; phase?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const vel = useRef(0);
  const ang = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const drive = Math.sin(now / 1000 + phase) * 0.012; // idle breeze
      const acc = -ang.current * 6 - vel.current * 1.6 + drive;
      vel.current += acc * dt;
      ang.current += vel.current * dt;
      el.style.transform = `rotate(${(ang.current * 57.3).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const push = () => { vel.current += 0.5; };
    el.addEventListener("pointerenter", push);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointerenter", push); };
  }, [phase]);
  return (
    <div className="flex flex-col items-center">
      <div className="w-px bg-border" style={{ height: wire }} aria-hidden />
      <div ref={ref} style={{ transformOrigin: `50% ${-wire}px` }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the GetStarted feature strip** — in `components/GetStarted.tsx`, replace the `<ul className="mt-3 flex flex-wrap …">…</ul>` FEATURES block with:

```tsx
        <div className="mt-2 flex flex-wrap items-start justify-center gap-6">
          {FEATURES.map((f, i) => (
            <HungCard key={f} wire={34 + (i % 3) * 14} phase={i * 1.7}>
              <span className="flex items-center gap-2 rounded-full border border-border bg-surface/80 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim backdrop-blur-sm">
                <span className="size-1 rounded-full bg-bull/70 pulse-dot" /> {f}
              </span>
            </HungCard>
          ))}
        </div>
```

with import `import { HungCard } from "@/components/atmosphere/HungCard";`

- [ ] **Step 3: Re-capture the reveal target** — `npm run cinema:capture` again (hung cards change the baked Get Started frame).

- [ ] **Step 4: Verify + commit**

tsc clean; Playwright `/` Get Started screenshot READ (cards hang on wires at varied heights). Then:

```bash
git add components/atmosphere/HungCard.tsx components/GetStarted.tsx public/cinema/shots/hero.webp
git commit -m "feat(home): pendulum-hung feature cards (reel-5 motion language)"
```

---

### Task 10: Ambient loop — living smoke behind Get Started (Higgsfield video)

**Files:**
- Create: `public/media/loops/smoke-loop.webm`
- Modify: `components/GetStarted.tsx`

- [ ] **Step 1: Generate** — `generate_video`, model `kling3_0_turbo`, `duration: 5`, `aspect_ratio: "16:9"`, preflight `get_cost` first, prompt:

```
Slow wisps of emerald green smoke drifting upward through pure black void,
subtle, sparse, elegant, seamless ambient loop, no objects, no text, no camera
movement, very dark — smoke occupies only the lower third.
```

- [ ] **Step 2: Download + compress to budget**

```bash
curl -sL "<video_url>" -o /tmp/smoke.mp4
ffmpeg -y -i /tmp/smoke.mp4 -an -vf "scale=1280:-2,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 40 public/media/loops/smoke-loop.webm
ls -la public/media/loops/  # expect ≤ 2.5MB
```

- [ ] **Step 3: Layer it into GetStarted** — first children of the section, beneath the grid:

```tsx
      <video
        src="/media/loops/smoke-loop.webm"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full object-cover opacity-25 motion-reduce:hidden"
      />
```

- [ ] **Step 4: Re-capture reveal target, verify, commit**

`npm run cinema:capture`; Playwright READ (smoke layer visible, embers/candles still read); tsc clean.

```bash
git add public/media/loops components/GetStarted.tsx public/cinema/shots/hero.webp
git commit -m "feat(home): ambient smoke loop under Get Started (Higgsfield/Kling)"
```

---

### Task 11: Performance + full sweep + ship

**Files:**
- Modify: none expected (fix whatever the sweep finds)

- [ ] **Step 1: Asset budget audit**

```bash
find public/media -type f -exec ls -la {} \; | awk '{print $5, $9}' | sort -rn | head
```

Expected: no still >300KB@1600 / >90KB@800, cutouts ≤350KB, loop ≤2.5MB. Re-run `finish.mjs` at lower q for any violator.

- [ ] **Step 2: Full-site Playwright sweep** — capture `/`, `/trade`, `/learn`, `/quant` desktop (1440×900) + `/` and `/trade` mobile (390×844); READ every frame; check: heroes legible, no CLS jumps (compare two captures 2s apart), no console pageerrors, cinema handoff intact.

- [ ] **Step 3: Checks**

Run: `npx tsc --noEmit && npx vitest run` → clean / 34+ passed.

- [ ] **Step 4: Final commit + push** (repo convention: no AI attribution trailers)

```bash
git add -A && git status --short   # review — only intended files
git commit -m "feat(design): cinematic materials pass — photoreal heroes, type-sandwich, curtains, hung cards, ambient loop"
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** all six reel techniques are mapped and tasked (r1/r6 → Tasks 3/5, r2 → Task 8, r3/r4 → Tasks 1/4/6, r5 → Task 9, r6-eye → Task 7); the bull-license debt is retired in Task 2; performance and reduced-motion are Task 11 + inline guards.
- **Ordering constraint:** Task 1 must precede Task 2 (GLB derives from the still) and Task 3 must precede Tasks 5 (uses `MaterialHero`). Tasks 4/6/7 are independent after Task 1's flow is proven.
- **Credit discipline:** every generation task preflights `get_cost`, uses `count: 2`, single retry max, upscales winners only (~22 generations worst case).
- **Known risk:** `image_to_3d` mesh quality varies — Task 2 Step 4 verifies in isolation before touching the live cinema, and the old GLB stays on disk as an instant rollback (`MODEL` is one line).
- **Reveal-target invariant:** any task that changes `GetStarted` visuals (7, 9, 10) re-runs `npm run cinema:capture` so the cinema's baked handoff frame never drifts.
