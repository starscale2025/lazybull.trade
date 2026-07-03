# Scroll Cinema — Homepage Hero (Design)

**Date:** 2026-07-03
**Status:** Approved by user (pre-implementation)
**Owner:** Shaurya

## What & why

An Apple-style scroll-driven cinematic on the `/` homepage: a video chopped into
frames, scrubbed on a `<canvas>` as the visitor scrolls. It tells the LazyBull
story in one continuous shot — the UI assembles into a MacBook, the camera
dives through the real product, a bull emerges for the brag moment, the screen
flashes bull-green, and the sequence hands off to the live homepage.

Decisions locked during brainstorming:

- **Location:** homepage hero — `<ScrollCinema />` inserted in `app/page.tsx`
  above the existing `<Hero />`. Nothing else on the homepage moves.
- **Production pipeline:** hybrid, $0 budget. UI acts are code-rendered from
  real app screenshots (pixel-perfect text; AI video garbles UI). The bull act
  is AI-generated via the free Google AI Studio Veo tier (user's account).
- **Placeholder-first:** the pipeline renders a green particle-silhouette bull
  until the real Veo clip exists. Swapping in the real bull is a pipeline
  re-run — zero code changes.

## The experience

Pinned section, ~500vh of scroll, full-viewport canvas, scrub tied to scroll:

| Scroll   | Act      | On screen                                                        |
| -------- | -------- | ---------------------------------------------------------------- |
| 0–12%    | Boot     | Dark void, MacBook outline materializes, LazyBull wordmark        |
| 12–32%   | Assembly | Real UI panels fall and snap into the MacBook screen              |
| 32–58%   | Dive     | Camera pushes into the screen, flies past floating real UI panels |
| 58–80%   | Bull     | Bull emerges center-frame (Veo footage; placeholder until then)   |
| 80–92%   | Flash    | Screen flashes bull-green — DOM overlay, not baked into frames    |
| 92–100%  | Handoff  | Flash resolves, canvas fades, pin releases onto the real homepage |

Copy beats render as DOM text overlays synced to scroll progress (crisp,
accessible, SEO-visible) — never baked into frames. Draft copy, to refine
during implementation:

- Boot: `lazybull.trade` — "options, without the fog"
- Assembly: "One terminal. Every tool."
- Dive: "27 bots · 13 models · 8 live demos" → "0.4ms pricing engine" →
  "$100K paper account"
- Bull: "Learn it. Backtest it. Only then trade it."
- Flash/Handoff: no copy; the page itself is the payoff.

## Architecture

- `components/scrollstory/ScrollCinema.tsx` (client component)
  - Pinned container (~500vh) with sticky full-viewport canvas.
  - GSAP ScrollTrigger scrub → scroll progress → frame index → canvas draw.
  - Chunked frame preloading: first ~24 frames eager, rest in background;
    decode via `createImageBitmap` where available.
  - Copy overlays + green flash driven by the same timeline config.
  - One typed config object: frame counts, act boundaries, copy beats.
- `lib/cinema.ts` — pure functions: `progressToFrame()`, act/copy-beat
  mapping, manifest parsing. Unit-testable without DOM.
- `public/cinema/frames/` — WebP sequence + `manifest.json`
  (frame count, dimensions, desktop/mobile variants).
- `app/page.tsx` — single insertion above `<Hero />`. Hero remains the
  landing view after handoff. `IntroSequence` stays untouched (session-gated
  3.5s boot overlay plays over Act 0's dark frames; they blend).

## Frame production pipeline (`scripts/cinema/`, not shipped)

1. **Capture** — Playwright (new devDependency) screenshots real pages
   (`/`, `/learn`, `/trade`) at 2x DPR.
2. **Render** — standalone HTML scene (CSS 3D + canvas, parameterized by
   `t ∈ [0,1]`) choreographs Boot/Assembly/Dive using those screenshots;
   Playwright steps `t` per frame and captures ~160 desktop frames (1600px)
   and ~160 mobile frames (800px).
3. **Bull** — exact Veo prompt provided in the implementation plan; the user
   generates it free in Google AI Studio and saves `scripts/cinema/bull.mp4`;
   ffmpeg (installed at `/opt/homebrew/bin/ffmpeg`) extracts and color-grades
   frames into the sequence. Absent `bull.mp4`, the renderer substitutes the
   particle-bull placeholder.
4. **Encode** — ffmpeg → WebP quality ~68. Payload budget: ≤9MB desktop set,
   ≤3MB mobile set.
5. **Commit** — the encoded frames in `public/cinema/frames/` are committed to
   git (~12MB total); Vercel serves them as static assets. The `scripts/cinema/`
   intermediates (screenshots, `bull.mp4`, raw PNGs) are gitignored.

## Performance & fallbacks

- Mobile serves the 800px frame set (manifest-selected by viewport/DPR);
  canvas draws cover-fit.
- `prefers-reduced-motion`: no pin, no scrub — static hero frame with copy
  laid out as a normal section.
- Added page JS <15KB gzipped (GSAP already a dependency). Frames are static
  assets, CDN-cached on Vercel.
- No-JS: first frame as poster + DOM copy still render.

## Testing & success criteria

- **Vitest first** (repo has vitest configured): `progressToFrame()` math,
  act/copy-beat mapping edge cases, manifest parsing.
- **Preview verification:** scripted scroll positions → screenshot +
  console-error check per act; handoff produces no layout shift.
- **Done means:** smooth scrub on desktop; placeholder bull swaps for Veo bull
  with zero code changes; reduced-motion path clean; homepage below the fold
  byte-identical in behavior.

## Out of scope

- No changes to `/learn`, `/about`, Nav, or any homepage section besides the
  insertion in `app/page.tsx`.
- No Higgsfield generation (0 credits) — revisit if the user tops up.
- No real Veo generation inside this repo's tooling; that step is manual by
  the user with a provided prompt.

## Known constraints

- `AGENTS.md` points to `node_modules/next/dist/docs/`, which does not exist
  in this install — the existing app code is the reference for Next 16
  patterns instead.
- Veo free tier (~100 credits/month, personal Google account) covers the
  ~8s bull clip; regeneration attempts are limited, so the prompt ships
  refined rather than iterated.
