"use client";

// TEMPORARY preview — renders the Bull3D layer in isolation at its risen pose so
// the crystal model + material can be judged without scrolling the cinema. Delete after.
import { useEffect, useState } from "react";
import Bull3D from "@/components/scrollstory/Bull3D";
import { cinemaClock } from "@/lib/cinema-clock";

export default function BullTest() {
  const [p, setP] = useState(0.755);
  useEffect(() => {
    cinemaClock.progress = p;
    const id = setInterval(() => { cinemaClock.progress = p; }, 80);
    return () => clearInterval(id);
  }, [p]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#050505" }}>
      <Bull3D active />
      <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 10, display: "flex", gap: 10, alignItems: "center", fontFamily: "monospace", color: "#7dffc9", fontSize: 13 }}>
        <span>pose {p.toFixed(3)}</span>
        <input type="range" min={0.71} max={0.99} step={0.005} value={p} onChange={(e) => setP(parseFloat(e.target.value))} style={{ width: 240 }} />
      </div>
    </div>
  );
}
