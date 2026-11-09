// Between two chapters (calm, S1, 2026-11-09): one quiet centred line. It was
// a pair of rules drawing in from the centre, tick marks, two spinning diamonds
// with a mint glow and a §NN→NN counter, over a grid wash.

export function AnimatedDivider({ label }: { label?: string }) {
  return <div className="py-3 text-center t-label text-fg-faint">{label}</div>;
}
