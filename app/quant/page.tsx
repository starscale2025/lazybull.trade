import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { QuantPage } from "@/components/quant/QuantPage";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/quant" },
  title: "QUANT // run math at the market",
  description:
    "A quant workbench for everyone. Stack bots like Jupyter cells, tune the math, see where they agree. Black-Scholes, Monte Carlo VaR, Z-Score reversion, Hurst, Kalman, Wheel backtest and more — plus your own.",
};

export default function Page() {
  return (
    <main className="tap-floor flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav wide />
      <QuantPage />
      <Footer />
    </main>
  );
}
