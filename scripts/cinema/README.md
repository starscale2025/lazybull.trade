# Scroll-cinema frame pipeline

Generates the frame sequence behind the homepage scroll hero
(`components/scrollstory/ScrollCinema.tsx`). Frames land in
`public/cinema/frames/` and ARE committed; everything in this folder's
`shots/` and `raw/` subdirs is intermediate and gitignored.

## Run it

1. Start the dev server: `npm run dev` (the pipeline screenshots the live
   `/`, `/learn`, and `/trade` pages, so they must be served).
2. `npm run cinema:capture`
   - `SITE=http://localhost:3001 npm run cinema:capture` for a non-default port.
   - `npm run cinema:capture -- --skip-shots` to reuse existing page screenshots
     (skips step 1's screenshots; still re-renders and re-encodes every frame).
3. Commit the regenerated `public/cinema/frames/`.

### Requirements

- **Playwright Chromium** — `npx playwright install chromium` (one-time).
- **cwebp** — `brew install webp`. The encoder is `cwebp`, not ffmpeg's
  `libwebp`, because common Homebrew ffmpeg builds ship without libwebp.
- **ffmpeg** — only needed to ingest a real bull clip (`bull.mp4`); the
  placeholder path does not require it.

## The bull (swap the placeholder for real footage)

The bull act (58–80% of the sequence) uses a green particle silhouette until
you provide real footage. To upgrade, generate an ~8s clip with your free
Google AI Studio Veo credits (aistudio.google.com → video generation):

**Prompt:**

> Cinematic product-film shot: a powerful black bull emerges from total
> darkness, walking slowly toward camera, head lowered, then rising proudly
> to face the lens. Neon green rim lighting (hex #00ff87) traces its
> silhouette against a pure black void. Sparse floating green embers in the
> deep background. Premium, dramatic, Apple-commercial mood. Slow push-in
> camera, shallow depth of field, photorealistic. Dark scene, single subject
> centered, no text, no logos.

**Settings:** 16:9, highest available resolution, ~8 seconds.

Then:

1. Save the clip as `scripts/cinema/bull.mp4`.
2. Re-run `npm run cinema:capture -- --skip-shots`.
3. Review the bull-act frames (~`frame_0094`–`frame_0128` in
   `public/cinema/frames/desktop/`), then commit.

No code changes needed — the pipeline detects `bull.mp4`, extracts and
color-grades frames with ffmpeg, and the scene cross-fades from the particle
placeholder to the footage automatically.

## Tuning

- Frame count / set sizes / quality: constants at the top of `capture.mjs`
  (`FRAME_COUNT`, `SETS`) and the `encodeSet` quality argument (default 68 —
  drop toward 58 if you ever exceed the 9MB desktop / 3MB mobile budgets;
  the current placeholder sets are ~2.2MB / ~1.5MB).
- Choreography: `scene.html`. Its `PHASES` boundaries MUST stay in sync with
  `ACTS` in `lib/cinema.ts` — the same six numbers.
- Copy beats: `COPY_BEATS` in `lib/cinema.ts`. They render as DOM overlays in
  the component, not baked into frames, so edit them there — no re-render needed.
