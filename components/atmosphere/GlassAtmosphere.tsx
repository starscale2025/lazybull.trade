/**
 * The aurora every glass surface refracts — mounted once, in the root layout.
 *
 * Translucent panels only read as glass if there is something behind them
 * worth seeing. On flat #050505 a 48%-alpha panel is just a slightly lighter
 * grey rectangle; over drifting phosphor orbs it becomes a material. So this
 * is not decoration bolted on after the fact — it is the half of the recipe
 * that makes the other half legible.
 *
 * It is `fixed` and `-z-10`, entirely behind page content, and inert to the
 * pointer. Pages that supply their own background (the landing's cinema, the
 * /pro terminal canvas) simply paint over it.
 *
 * Cost: three blurred gradients and one masked grid, all composited on the GPU
 * and none of them animating layout. The drift keyframes are the existing 18s
 * brand loop, and `prefers-reduced-motion` stops them (see globals.css).
 */
export function GlassAtmosphere() {
  return (
    <div className="glass-aurora glass-aurora--fixed" aria-hidden>
      <i className="a1" />
      <i className="a2" />
      <i className="a3" />
    </div>
  );
}
