/* eslint-disable @next/next/no-html-link-for-pages */

/**
 * AmbientOrbs renders three slow-drifting blurred gradient orbs as a fixed
 * background atmosphere. Pure CSS — no JS, no client component required.
 * Place once near the root of the page; orbs sit at z-0 below content.
 */
export function AmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="ambient-orb orb-drift-1"
        style={{
          top: "8%",
          left: "-10%",
          width: 520,
          height: 520,
          background: "radial-gradient(circle, rgba(88,46,255,0.3) 0%, rgba(88,46,255,0) 70%)",
          opacity: 0.7,
        }}
      />
      <div
        className="ambient-orb orb-drift-2"
        style={{
          top: "40%",
          right: "-8%",
          width: 460,
          height: 460,
          background: "radial-gradient(circle, rgba(56,132,255,0.18) 0%, rgba(56,132,255,0) 70%)",
          opacity: 0.55,
          animationDelay: "-7s",
        }}
      />
      <div
        className="ambient-orb orb-drift-3"
        style={{
          bottom: "-10%",
          left: "30%",
          width: 540,
          height: 540,
          background: "radial-gradient(circle, rgba(82,255,165,0.08) 0%, rgba(82,255,165,0) 70%)",
          opacity: 0.5,
          animationDelay: "-13s",
        }}
      />
    </div>
  );
}
