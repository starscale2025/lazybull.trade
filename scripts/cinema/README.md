# Scroll-cinema

The homepage scroll hero (`components/scrollstory/ScrollCinema.tsx`) renders the
scene **live**: it embeds `public/cinema/scene.html` in a pinned iframe and calls
its `renderAt(t)` every animation frame, driven by a smooth-scrubbed scroll
progress. Because the scene is a pure function of `t` (renders in ~1ms), it draws
every in-between frame at 60fps — smooth at any scroll speed, no pre-rendered
frame stepping.

The only build artifacts are the **plates**: seven diagrams (strategy builder,
options chain, a learn chapter, the quant workbench, pro charts, the bot
library, about) that the scene flies past in the dive and that the landing's
feature rows show. They live in `public/cinema/plates/*.svg` and ARE committed.

They used to be screenshots of the app, and screenshots go stale silently: the
film kept advertising screens the product had removed, and nothing in
`npm run verify` could notice. The plates are drawn from code, every number on
them is labelled illustrative, and the compliance lint reads them like any
other source file.

## Redraw the plates

`npm run cinema:plates` (no server, no browser) rewrites
`public/cinema/plates/*.svg` from `scripts/cinema/plates.mjs`. Commit the result.

## Tuning the animation

- **Choreography / visuals**: `public/cinema/scene.html`. Its `PHASES`
  boundaries MUST stay in sync with `ACTS` in `lib/cinema.ts` (initScene
  passes them in; the table in the file is only the standalone fallback). Because the scene renders live, edits show up on reload with no
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
