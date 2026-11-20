// Snap: the live chart <svg> as a file that draws the same anywhere.
//
// The chart paints through the page's CSS: var(--bull) and var(--bear) on
// every candle, currentColor under text-* classes, a web font with a hashed
// name. Serialized as-is, a viewer has none of that, so the candles came out
// black on nothing. The old export also wrote a second xmlns onto the root,
// which made the file invalid XML: it would not open at all.
//
// So the copy carries each element's computed paint as plain values, drops
// the classes, falls back to fonts a viewer has, and gets a real size, a
// background and a header line naming what it shows.

const SVG_NS = "http://www.w3.org/2000/svg";
const HEADER = 28; // px of band above the plot for the title line

const PAINT = ["fill", "stroke", "stop-color"] as const;
const UNLESS_ONE = ["opacity", "fill-opacity", "stroke-opacity", "stop-opacity"] as const;
const TEXT = ["font-size", "font-weight", "letter-spacing", "text-anchor", "dominant-baseline"] as const;

function fontStack(family: string): string {
  return /mono|jetbrains|menlo|consol/i.test(family)
    ? `"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`
    : `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/** The first solid background behind an element, for the file's backdrop. */
export function backdropOf(el: Element | null, fallback = "#050505"): string {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg;
  }
  return fallback;
}

export function selfContainedSvg(svg: SVGSVGElement, title: string, background: string): string {
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : box.width;
  const h = vb && vb.height ? vb.height : box.height;
  const x0 = vb ? vb.x : 0;
  const y0 = vb ? vb.y : 0;

  const copy = svg.cloneNode(true) as SVGSVGElement;
  // Both lists walk the same tree in the same order, so index i is one element.
  const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const dst = [copy, ...Array.from(copy.querySelectorAll("*"))];
  const drop: Element[] = [];

  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    const d = dst[i];
    const cs = getComputedStyle(s);
    if (i > 0 && (cs.display === "none" || cs.visibility === "hidden")) {
      drop.push(d);
      continue;
    }
    const style: string[] = [];
    const tag = s.tagName.toLowerCase();
    const container = tag === "g" || tag === "svg" || tag === "defs" || tag === "clippath";
    if (!container) {
      for (const p of PAINT) {
        if (p === "stop-color" ? tag === "stop" : tag !== "stop") style.push(`${p}:${cs.getPropertyValue(p)}`);
      }
      const stroke = cs.getPropertyValue("stroke");
      if (stroke && stroke !== "none") {
        style.push(`stroke-width:${cs.getPropertyValue("stroke-width")}`);
        const dash = cs.getPropertyValue("stroke-dasharray");
        if (dash && dash !== "none") style.push(`stroke-dasharray:${dash}`, `stroke-dashoffset:${cs.getPropertyValue("stroke-dashoffset")}`);
      }
    }
    for (const p of UNLESS_ONE) {
      const v = cs.getPropertyValue(p);
      if (v && v !== "1") style.push(`${p}:${v}`);
    }
    if (tag === "text" || tag === "tspan") {
      style.push(`font-family:${fontStack(cs.getPropertyValue("font-family"))}`);
      for (const p of TEXT) {
        const v = cs.getPropertyValue(p);
        if (v && v !== "normal" && v !== "auto") style.push(`${p}:${v}`);
      }
    }
    d.removeAttribute("class");
    // Whatever still says var(...) is now set in style; drop it so no viewer
    // meets a variable it can't resolve.
    for (const a of Array.from(d.attributes)) if (a.value.includes("var(")) d.removeAttribute(a.name);
    if (style.length) d.setAttribute("style", style.join(";"));
    else d.removeAttribute("style");
  }
  for (const d of drop) d.remove();

  // A real size, room for the header, and none of the live page's wiring.
  for (const a of ["tabindex", "role", "aria-roledescription", "aria-label", "style"]) copy.removeAttribute(a);
  copy.setAttribute("width", String(Math.round(w)));
  copy.setAttribute("height", String(Math.round(h + HEADER)));
  copy.setAttribute("viewBox", `${x0} ${y0 - HEADER} ${w} ${h + HEADER}`);

  const doc = copy.ownerDocument;
  const titleEl = doc.createElementNS(SVG_NS, "title");
  titleEl.textContent = title;
  const bg = doc.createElementNS(SVG_NS, "rect");
  bg.setAttribute("x", String(x0));
  bg.setAttribute("y", String(y0 - HEADER));
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h + HEADER));
  bg.setAttribute("style", `fill:${background}`);
  const head = doc.createElementNS(SVG_NS, "text");
  head.setAttribute("x", String(x0 + 12));
  head.setAttribute("y", String(y0 - HEADER / 2 + 4));
  head.setAttribute("style", `fill:#bdbcb3;font-family:${fontStack("mono")};font-size:11px;letter-spacing:0.04em`);
  head.textContent = title;
  copy.insertBefore(head, copy.firstChild);
  copy.insertBefore(bg, copy.firstChild);
  copy.insertBefore(titleEl, copy.firstChild);

  // The serializer writes the SVG namespace itself, once.
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`;
}
