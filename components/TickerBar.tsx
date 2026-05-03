const TICKERS = [
  { sym: "AMZN", price: "226.45", chg: "+1.18%", up: true },
  { sym: "NVDA", price: "138.90", chg: "+3.07%", up: true },
  { sym: "TSLA", price: "287.15", chg: "−1.44%", up: false },
  { sym: "AAPL", price: "229.83", chg: "+0.51%", up: true },
  { sym: "MSFT", price: "428.71", chg: "+0.92%", up: true },
  { sym: "AMD", price: "162.04", chg: "−2.18%", up: false },
  { sym: "META", price: "603.27", chg: "+1.74%", up: true },
  { sym: "GOOGL", price: "189.05", chg: "+0.34%", up: true },
  { sym: "SPY", price: "612.40", chg: "+0.41%", up: true },
  { sym: "QQQ", price: "540.10", chg: "+0.62%", up: true },
  { sym: "IWM", price: "228.07", chg: "−0.18%", up: false },
  { sym: "GLD", price: "271.20", chg: "+0.21%", up: true },
  { sym: "VIX", price: "14.82", chg: "−0.94%", up: false },
  { sym: "GME", price: "31.20", chg: "+12.4%", up: true },
  { sym: "PLTR", price: "78.42", chg: "+2.18%", up: true },
  { sym: "COIN", price: "287.65", chg: "−0.62%", up: false },
  { sym: "AVGO", price: "212.50", chg: "+1.04%", up: true },
  { sym: "NFLX", price: "904.18", chg: "+0.27%", up: true },
];

export function TickerBar() {
  const items = [...TICKERS, ...TICKERS];
  return (
    <div className="relative overflow-hidden border-b border-border bg-bg font-mono text-[11px] uppercase tracking-wider">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 bg-bg pl-3 pr-4 border-r border-border">
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        <span className="text-bull">LIVE</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-dim hidden sm:inline">NYSE OPEN</span>
      </div>
      <div className="flex marquee gap-8 py-2 pl-32">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <span className="text-fg-dim">{t.sym}</span>
            <span className="text-fg">{t.price}</span>
            <span className={t.up ? "text-bull" : "text-bear"}>{t.chg}</span>
            <span className="text-fg-faint">·</span>
          </span>
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 z-10 flex items-center gap-2 bg-bg pl-4 pr-3 border-l border-border">
        <span className="text-fg-dim">14:23:08</span>
        <span className="text-fg-faint">UTC</span>
      </div>
    </div>
  );
}
