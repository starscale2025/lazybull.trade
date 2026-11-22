// Dust rising off the horizon on /start: a few dozen soft motes on a small
// canvas at 1x. It owns no clock; the stage's one frame loop calls step().

type Mote = { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; warm: boolean };

export function createDust(canvas: HTMLCanvasElement, count = 70) {
  const ctx = canvas.getContext("2d");
  const motes: Mote[] = [];
  let w = 0;
  let h = 0;
  let horizon = 0;

  const place = (m: Mote, anywhere: boolean) => {
    m.x = Math.random() * w;
    // born along the horizon, or (at the start) already on their way up
    m.y = horizon + 30 - Math.random() * (anywhere ? horizon * 0.9 : 50);
    m.vx = (Math.random() - 0.5) * 7;
    m.vy = -(5 + Math.random() * 17);
    m.r = 0.7 + Math.random() * 1.4;
    m.life = 6 + Math.random() * 9;
    m.age = anywhere ? Math.random() * m.life : 0;
    m.warm = Math.random() < 0.18;
  };

  return {
    resize(width: number, height: number, horizonY: number) {
      w = width;
      h = height;
      horizon = horizonY;
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      motes.length = 0;
      for (let i = 0; i < count; i++) {
        const m = {} as Mote;
        place(m, true);
        motes.push(m);
      }
    },
    step(dt: number) {
      if (!ctx || !w) return;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.age += dt;
        if (m.age > m.life || m.y < -4) place(m, false);
        m.x += (m.vx + Math.sin(m.age * 0.9 + m.r * 7) * 3) * dt;
        m.y += m.vy * dt;
        const a = Math.sin((Math.PI * m.age) / m.life) * 0.6;
        ctx.fillStyle = m.warm ? `rgba(245,255,250,${a.toFixed(3)})` : `rgba(90,255,170,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    clear() {
      ctx?.clearRect(0, 0, w, h);
    },
  };
}
