# Scroll-cinema

The homepage scroll hero (`components/scrollstory/ScrollCinema.tsx`) renders the
scene **live**: it embeds `public/cinema/scene.html` in a pinned iframe and calls
its `renderAt(t)` every animation frame, driven by a smooth-scrubbed scroll
progress. Because the scene is a pure function of `t` (renders in ~1ms), it draws
every in-between frame at 60fps — smooth at any scroll speed, no pre-rendered
frame stepping.

The only build artifacts are the **shots** — screenshots of distinct app screens
the scene composites into the flying panels and the final reveal hero. They live
in `public/cinema/shots/*.webp` and ARE committed. Raw PNGs in this folder's
`shots/` subdir are intermediate and gitignored.

## Regenerate the shots (only when those pages change visually)

1. Start the dev server: `npm run dev` (the pipeline screenshots the live pages).
2. `npm run cinema:capture` — screenshots `/`, `/learn`, `/trade`, `/quant`,
   `/pro`, `/trade/chain`, `/learn/bots`, `/about`, and the real `<Hero>`, then
   encodes them to `public/cinema/shots/*.webp`.
   - `SITE=http://localhost:3001 npm run cinema:capture` for a non-default port.
3. Commit the regenerated `public/cinema/shots/`.

### Requirements

- **Playwright Chromium** — `npx playwright install chromium` (one-time).
- **cwebp** — `brew install webp` (the shot encoder).

## Tuning the animation

- **Choreography / visuals**: `public/cinema/scene.html`. Its `PHASES`
  boundaries MUST stay in sync with `ACTS` in `lib/cinema.ts` — the same six
  numbers. Because the scene renders live, edits show up on reload with no
  re-capture needed.
- **Pace & smoothness**: `SCROLL_LENGTH_VH` (pin length) and the `SMOOTH` lerp
  factor in `ScrollCinema.tsx`.
- **Copy beats**: `COPY_BEATS` in `lib/cinema.ts` — DOM overlays rendered by the
  component over the iframe.

## The bull

The bull act (58–80%) is a code-drawn green particle silhouette, generated live
in `scene.html`. To swap in real footage later you'd serve the frames and pass
their URLs as `bullFrames` to `initScene` (the scene already supports it); the
Veo prompt for such a clip is preserved in git history.
