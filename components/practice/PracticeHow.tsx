// How a problem is judged, at the foot of /practice: the deck's four-up row
// (slide 12, "What the beta has to prove"), a mono label over a serif title
// over two lines of plain English.
//
// Every line describes what the code does today — lib/practice/use-judge.ts
// (the browser runs the cases, the server compares), lib/practice/judge.ts
// (the 1e-6 rule), lib/practice/content (3 visible + 6 hidden cases a
// problem) and lib/practice/progress.ts (the ledger, synced once signed in).
// If one of those changes, this copy changes with it.
//
// PURE — no hooks. Server-rendered.

const POINTS = [
  {
    k: "01 · Run",
    t: "Real Python, in your browser",
    d: "Your code runs on Python 3.13 in the page itself, through Pyodide. Run checks it against the three visible cases as often as you like.",
  },
  {
    k: "02 · Submit",
    t: "Six hidden cases decide it",
    d: "Submit adds six cases you have not seen. Their expected answers never leave the server, which grades your outputs to six decimal places (one part in a million for answers above 1).",
  },
  {
    k: "03 · Record",
    t: "Proof of what you can do",
    d: "Accepted submits build your streak, badges and profile. Sign in and the record follows you from device to device.",
  },
  {
    k: "04 · Stakes",
    t: "Nothing at risk but the streak",
    d: "Practice puts no money on the line. It is paper only, educational, and never advice.",
  },
] as const;

export function PracticeHow() {
  return (
    <section aria-labelledby="how-title" className="shell mt-[clamp(4.5rem,9vw,7.5rem)] pb-[clamp(4rem,8vw,6rem)]">
      <div className="border-t border-[var(--deck-rule)] pt-10">
        <p className="deck-eyebrow">How it’s judged</p>
        <h2 id="how-title" className="deck-h2 mt-4 max-w-[22ch] text-fg">
          Graded on cases <span className="deck-accent">you have not seen</span>
        </h2>
        <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p) => (
            <li key={p.k} className="flex flex-col">
              <span className="deck-label text-bull">{p.k}</span>
              <h3 className="deck-h3 mt-3 text-fg">{p.t}</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-fg-dim">{p.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
