// A squarified treemap (Bruls, Huizing and van Wijk, 2000): areas in
// proportion to values, laid in rows that keep each tile as close to square as
// the values allow, so a label fits and the eye compares areas, not slivers.
// Pure geometry: the market map on /start lays sectors with it, then the
// stocks inside each sector.

export type Rect = { x: number; y: number; w: number; h: number };
export type Placed<T> = Rect & { data: T };

/** Lay `items` (any order, positive values) into `rect`, largest first. */
export function squarify<T>(items: { value: number; data: T }[], rect: Rect): Placed<T>[] {
  const live = items.filter((i) => i.value > 0 && Number.isFinite(i.value)).sort((a, b) => b.value - a.value);
  const total = live.reduce((s, i) => s + i.value, 0);
  if (!live.length || total <= 0 || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const queue = live.map((i) => ({ area: i.value * scale, data: i.data }));
  const out: Placed<T>[] = [];
  let free: Rect = { ...rect };
  let row: typeof queue = [];

  // The worst aspect ratio in a row laid along a side of length `side`.
  const worst = (r: typeof queue, side: number) => {
    if (!r.length) return Infinity;
    const s = r.reduce((a, i) => a + i.area, 0);
    const max = Math.max(...r.map((i) => i.area));
    const min = Math.min(...r.map((i) => i.area));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  const layRow = (r: typeof queue) => {
    const s = r.reduce((a, i) => a + i.area, 0);
    if (free.w >= free.h) {
      // a column down the left of the free space
      const colW = s / free.h;
      let y = free.y;
      for (const i of r) {
        const h = i.area / colW;
        out.push({ x: free.x, y, w: colW, h, data: i.data });
        y += h;
      }
      free = { x: free.x + colW, y: free.y, w: free.w - colW, h: free.h };
    } else {
      // a row across the top of the free space
      const rowH = s / free.w;
      let x = free.x;
      for (const i of r) {
        const w = i.area / rowH;
        out.push({ x, y: free.y, w, h: rowH, data: i.data });
        x += w;
      }
      free = { x: free.x, y: free.y + rowH, w: free.w, h: free.h - rowH };
    }
  };

  for (const item of queue) {
    const side = Math.min(free.w, free.h);
    if (!row.length || worst([...row, item], side) <= worst(row, side)) {
      row.push(item);
    } else {
      layRow(row);
      row = [item];
    }
  }
  if (row.length) layRow(row);
  return out;
}
