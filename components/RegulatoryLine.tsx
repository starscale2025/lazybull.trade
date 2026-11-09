// The disclaimer the app routes carry. The full one lives in the footer, which
// /trade, /trade/chain, /pro and /portfolio do not render, so those were the
// screens where a trade is actually placed and the only ones with no statement
// of what lazybull is not. One line, smallest voice, same words everywhere.
// No hooks: safe in server and client trees alike.

export const REGULATORY_LINE =
  "Paper only · $0 real money · education, not advice · not registered with SEBI as an investment adviser or research analyst";

export function RegulatoryLine({ extra, className = "" }: { extra?: string; className?: string }) {
  return (
    <p className={`t-label text-balance text-center text-fg-faint ${className}`}>
      {REGULATORY_LINE}
      {extra ? ` · ${extra}` : ""}
    </p>
  );
}
