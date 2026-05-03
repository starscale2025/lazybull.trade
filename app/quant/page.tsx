import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { QuantPage } from "@/components/quant/QuantPage";

export const metadata = {
  title: "QUANT // run math at the market",
  description:
    "A quant workbench for everyone. Stack bots like Jupyter cells, tune the math, see where they agree. Black-Scholes, Monte Carlo VaR, Z-Score reversion, Hurst, Kalman, Wheel backtest and more — plus your own.",
};

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />
      <QuantPage />
      <Footer />
    </main>
  );
}
