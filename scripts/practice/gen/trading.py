"""Trading track — ten problems."""

from common import Spec, case

VWAP = Spec(
    slug="vwap-session",
    fn="vwap",
    statement=[
        "Implement `vwap(bars)` — the session volume-weighted average price. Each bar is `[high, low, close, volume]`; use the typical price `(high + low + close) / 3` for the bar and weight it by the bar's volume: `Σ typical·volume / Σ volume`.",
        "VWAP is the benchmark every execution desk is measured against, and the line this site once drew wrong — the confession is at /learn/broken-vwap. Return the price rounded to 4 decimal places.",
    ],
    constraints=["1 ≤ len(bars) ≤ 390", "total volume > 0"],
    hints=[
        "Two running sums: price × volume, and volume.",
        "An unweighted average of typical prices is only a VWAP when every bar traded the same volume.",
        "Divide the sum of typical × volume by the sum of volume — the volume is the whole point.",
    ],
    ref="""
def vwap(bars):
    pv = 0.0
    vol = 0.0
    for h, l, c, v in bars:
        pv += (h + l + c) / 3 * v
        vol += v
    return round(pv / vol, 4)
""",
    stub_py="""
def vwap(bars: list) -> float:
    \"\"\"Session VWAP from [high, low, close, volume] bars, rounded to 4 dp.\"\"\"
    total = 0.0
    for h, l, c, v in bars:
        total += (h + l + c) / 3
    # TODO: weight each bar by its volume — this is a plain average, not a VWAP
    return round(total / len(bars), 4)
""",
    stub_ts="""
/** Session VWAP from [high, low, close, volume] bars, rounded to 4 dp. */
export function vwap(bars: [number, number, number, number][]): number {
  let total = 0;
  for (const [h, l, c] of bars) {
    total += (h + l + c) / 3;
  }
  // TODO: weight each bar by its volume — this is a plain average, not a VWAP
  return Math.round((total / bars.length) * 1e4) / 1e4;
}
""",
    cases=[
        case("1", bars=[[101.0, 99.0, 100.0, 1000.0], [102.0, 100.0, 101.0, 1000.0], [103.0, 101.0, 102.0, 1000.0]]),
        case("2", bars=[[50.5, 49.5, 50.0, 500.0], [51.0, 50.0, 50.5, 500.0]]),
        case("3", bars=[[101.0, 99.0, 100.0, 3000.0], [102.0, 100.0, 101.0, 1000.0], [103.0, 101.0, 102.0, 500.0]]),
        case("h1", bars=[[10.2, 9.8, 10.0, 100.0]]),
        case("h2", bars=[[200.0, 198.0, 199.0, 200.0], [201.0, 199.0, 200.0, 800.0], [202.0, 200.0, 201.0, 2000.0]]),
        case("h3", bars=[[75.0, 74.0, 74.5, 250.0], [75.5, 74.5, 75.0, 250.0], [76.0, 75.0, 75.5, 250.0], [75.0, 74.0, 74.5, 250.0]]),
        case("h4", bars=[[1.05, 0.95, 1.0, 10.0], [1.1, 1.0, 1.05, 10.0]]),
        case("h5", bars=[[300.0, 298.0, 299.0, 1500.0], [299.0, 297.0, 298.0, 1500.0]]),
        case("h6", bars=[[20.0, 19.0, 19.5, 700.0], [20.5, 19.5, 20.0, 700.0], [21.0, 20.0, 20.5, 700.0]]),
    ],
    examples=["1", "3"],
    example_notes={"3": "Three times the volume traded at the low bar — the VWAP has to sit lower than the plain average."},
    dataset="AAPL · 2024-03-04 · 1-min bars · 390 rows",
    editorial=[
        "VWAP is the average price at which a session actually traded, not the average of its prices. Every bar contributes its typical price weighted by how much volume printed there, so a heavy bar at the open pulls the line towards the open and a quiet drift in the afternoon barely moves it.",
        "The implementation is two running sums — price times volume, and volume — and one division at the end. Anchor both sums at the session open; a VWAP that carries yesterday's volume across midnight is measuring a different thing.",
        "This site once shipped the plain average by mistake: a mean of typical prices that ignored volume entirely, indistinguishable from the real line on a quiet day and wrong by a dollar on a busy one. The write-up is at /learn/broken-vwap. The untouched stub here is that bug, on purpose.",
        "Execution desks are judged against VWAP because it is the price a passive participant would have paid. Beat it and you added value; miss it and you paid for immediacy. The /pro chart draws it as the anchored line under the candles.",
    ],
)

KELLY = Spec(
    slug="kelly-fraction",
    fn="kelly_fraction",
    statement=[
        "Implement `kelly_fraction(p, b)` — the Kelly criterion for a bet that wins with probability `p` and pays `b` to 1: `f* = (p·b - (1 - p)) / b`. When the edge is negative the right size is zero — never a short position in your own bankroll — so clamp the result at 0.",
        "Kelly is the size that maximises long-run growth; anything above it grows slower and swings harder, which is why practitioners bet half of it. The workbench's Kelly bot shows both. Return the fraction rounded to 4 decimal places.",
    ],
    constraints=["0 ≤ p ≤ 1", "b > 0"],
    hints=[
        "Edge is p·b − q, where q = 1 − p; divide by the odds b.",
        "What should the formula return for a bet you expect to lose?",
        "A negative fraction is not a bet — clamp at zero with max(0, f).",
    ],
    ref="""
def kelly_fraction(p, b):
    f = (p * b - (1 - p)) / b
    return round(max(0.0, f), 4)
""",
    stub_py="""
def kelly_fraction(p: float, b: float) -> float:
    \"\"\"Kelly bet size as a fraction of bankroll, rounded to 4 dp.\"\"\"
    q = 1 - p
    f = (p * b - q) / b
    # TODO: a negative edge means no bet — clamp the fraction at zero
    return round(f, 4)
""",
    stub_ts="""
/** Kelly bet size as a fraction of bankroll, rounded to 4 dp. */
export function kellyFraction(p: number, b: number): number {
  const q = 1 - p;
  const f = (p * b - q) / b;
  // TODO: a negative edge means no bet — clamp the fraction at zero
  return Math.round(f * 1e4) / 1e4;
}
""",
    cases=[
        case("1", p=0.55, b=1.0),
        case("2", p=0.4, b=2.0),
        case("3", p=0.45, b=1.0),
        case("h1", p=0.6, b=1.5),
        case("h2", p=0.3, b=2.0),
        case("h3", p=0.5, b=1.0),
        case("h4", p=0.7, b=0.5),
        case("h5", p=0.52, b=1.0),
        case("h6", p=0.25, b=3.0),
    ],
    examples=["1", "3"],
    example_notes={"3": "A coin that loses 55% of the time at even money — the right size is nothing."},
    editorial=[
        "Kelly asks a precise question: what fraction of your bankroll, bet repeatedly on the same edge, makes your capital grow fastest in the long run? For a bet that wins with probability p and pays b to 1, the answer is f* = (p·b − (1 − p)) / b — the edge divided by the odds.",
        "Two properties matter more than the formula. Above f* growth slows and volatility rises, and at 2·f* the expected growth rate is zero — you can have an edge and still go broke by sizing it wrong. And a negative f* is not an instruction to short; it is the market telling you the bet is bad. Clamp at zero.",
        "The untouched stub returns the negative number. It passes every case with a positive edge and fails the moment the coin is against you, which is exactly the situation sizing rules exist for.",
        "Published practice sizes below f*, because p and b are estimates and estimation error is asymmetric: overbetting costs more than underbetting gives up. The workbench's Kelly bot prints f* alongside the stake at which expected growth reaches zero for that reason — the distance between the two is how wrong the estimate can be before the edge stops compounding.",
    ],
)

SMA_CROSS = Spec(
    slug="sma-crossover",
    fn="sma_cross_signals",
    statement=[
        "Implement `sma_cross_signals(closes, fast, slow)` — for every bar where both simple moving averages exist (from index `slow - 1` onward), emit `1` if the fast SMA is strictly above the slow, `-1` if strictly below, and `0` when they are exactly equal.",
        "It is the oldest trend signal there is and the workbench's first bot. Return the list of signals.",
    ],
    constraints=["1 ≤ fast < slow ≤ len(closes) ≤ 10_000"],
    hints=[
        "An SMA at bar t averages the `period` closes ending at t, inclusive.",
        "Equal averages are not a bullish cross. Use strict comparisons and let the tie be zero.",
    ],
    ref="""
def sma_cross_signals(closes, fast, slow):
    def sma(t, period):
        return sum(closes[t - period + 1:t + 1]) / period
    out = []
    for t in range(slow - 1, len(closes)):
        f = sma(t, fast)
        s = sma(t, slow)
        out.append(1 if f > s else -1 if f < s else 0)
    return out
""",
    stub_py="""
def sma_cross_signals(closes: list, fast: int, slow: int) -> list:
    \"\"\"1 fast above slow, -1 below, 0 equal — one per bar from slow - 1.\"\"\"
    def sma(t, period):
        return sum(closes[t - period + 1:t + 1]) / period

    out = []
    for t in range(slow - 1, len(closes)):
        f = sma(t, fast)
        s = sma(t, slow)
        # TODO: a tie is not a cross — equal averages should be 0, not 1
        out.append(1 if f >= s else -1)
    return out
""",
    cases=[
        case("1", closes=[10.0, 11.0, 12.0, 13.0, 12.0, 11.0], fast=2, slow=3),
        case("2", closes=[100.0, 99.0, 98.0, 99.0, 101.0, 103.0], fast=2, slow=4),
        case("3", closes=[10.0, 12.0, 11.0, 11.0, 11.0, 13.0], fast=2, slow=3),
        case("h1", closes=[5.0, 6.0, 7.0, 8.0], fast=1, slow=2),
        case("h2", closes=[20.0, 20.0, 20.0, 21.0, 22.0], fast=2, slow=3),
        case("h3", closes=[50.0, 49.0, 48.0, 47.0, 46.0], fast=2, slow=3),
        case("h4", closes=[1.0, 2.0, 1.5, 2.5, 2.0, 3.0, 2.5], fast=3, slow=5),
        case("h5", closes=[100.0, 102.0, 101.0, 104.0], fast=2, slow=3),
        case("h6", closes=[30.0, 29.0, 31.0, 28.5, 32.0, 27.0], fast=2, slow=4),
    ],
    examples=["1", "3"],
    example_notes={"3": "Three flat closes make the two averages equal — a 0, not a buy."},
    dataset="AMZN · 180 daily closes · seed 11",
)

DONCHIAN = Spec(
    slug="donchian-breakout",
    fn="donchian_signals",
    statement=[
        "Implement `donchian_signals(highs, lows, closes, window)` — for every bar `t >= window`, emit `1` if the close is STRICTLY above the highest high of the previous `window` bars (`highs[t - window : t]`, today excluded), `-1` if STRICTLY below the lowest low of those bars, else `0`.",
        "Buy the breakout, sell the breakdown — the turtle rule, and the workbench's Donchian bot. Return the list of signals, one per bar from `t = window` onward.",
    ],
    constraints=["1 ≤ window < len(closes) ≤ 10_000", "lows ≤ closes ≤ highs elementwise"],
    hints=[
        "The channel is built from the bars BEFORE today.",
        "Touching the channel is not breaking it — strict inequalities.",
    ],
    ref="""
def donchian_signals(highs, lows, closes, window):
    out = []
    for t in range(window, len(closes)):
        hi = max(highs[t - window:t])
        lo = min(lows[t - window:t])
        out.append(1 if closes[t] > hi else -1 if closes[t] < lo else 0)
    return out
""",
    stub_py="""
def donchian_signals(highs: list, lows: list, closes: list, window: int) -> list:
    \"\"\"1 breakout, -1 breakdown, 0 inside the channel — from t = window onward.\"\"\"
    out = []
    for t in range(window, len(closes)):
        hi = max(highs[t - window:t])
        lo = min(lows[t - window:t])
        # TODO: touching the channel is not a breakout — the comparisons must be strict
        out.append(1 if closes[t] >= hi else -1 if closes[t] <= lo else 0)
    return out
""",
    cases=[
        case("1", highs=[10.0, 11.0, 12.0, 13.0], lows=[9.0, 10.0, 11.0, 12.0], closes=[9.5, 10.5, 11.5, 12.9], window=2),
        case("2", highs=[50.0, 51.0, 50.5, 49.0], lows=[49.0, 50.0, 49.5, 47.0], closes=[49.5, 50.5, 50.0, 48.0], window=2),
        case("3", highs=[10.0, 11.0, 12.0, 13.0], lows=[9.0, 10.0, 11.0, 12.0], closes=[9.5, 10.5, 11.0, 12.5], window=2),
        case("h1", highs=[5.0, 5.5, 6.0], lows=[4.5, 5.0, 5.5], closes=[4.8, 5.2, 6.2], window=2),
        case("h2", highs=[20.0, 21.0, 22.0, 22.0], lows=[19.0, 20.0, 21.0, 20.0], closes=[19.5, 20.5, 21.5, 22.0], window=3),
        case("h3", highs=[100.0, 102.0, 101.0, 105.0, 99.0], lows=[98.0, 100.0, 99.0, 103.0, 96.0], closes=[99.0, 101.0, 100.0, 104.0, 97.0], window=3),
        case("h4", highs=[1.0, 1.2, 1.1], lows=[0.9, 1.0, 0.95], closes=[0.95, 1.1, 1.05], window=1),
        case("h5", highs=[30.0, 31.0, 32.0, 33.0, 34.0], lows=[29.0, 30.0, 31.0, 32.0, 33.0], closes=[29.5, 30.5, 31.5, 32.5, 33.5], window=2),
        case("h6", highs=[75.0, 74.0, 73.0, 72.0], lows=[74.0, 73.0, 72.0, 71.0], closes=[74.5, 73.5, 72.5, 71.5], window=2),
    ],
    examples=["1", "3"],
    example_notes={"3": "The third close sits exactly on the prior low — inside the channel, a 0."},
)

POSITION_SIZE = Spec(
    slug="position-size-by-stop",
    fn="position_size",
    statement=[
        "Implement `position_size(equity, risk_frac, entry, stop)` — the number of WHOLE shares to buy so that being stopped out loses at most `equity·risk_frac`: `floor(equity·risk_frac / |entry - stop|)`.",
        "Risk a fixed fraction per trade and let the stop set the size — the rule the safety settings on this site enforce for you. Return an integer.",
    ],
    constraints=["equity > 0", "0 < risk_frac ≤ 0.05", "entry != stop"],
    hints=[
        "Dollars at risk divided by dollars at risk per share.",
        "You cannot buy 41.6 shares — floor it.",
    ],
    ref="""
from math import floor

def position_size(equity, risk_frac, entry, stop):
    return floor(equity * risk_frac / abs(entry - stop))
""",
    stub_py="""
def position_size(equity: float, risk_frac: float, entry: float, stop: float) -> int:
    \"\"\"Whole shares such that a stop-out loses at most equity × risk_frac.\"\"\"
    per_share = abs(entry - stop)
    # TODO: whole shares — floor the result instead of returning a fraction
    return equity * risk_frac / per_share
""",
    cases=[
        case("1", equity=10000.0, risk_frac=0.01, entry=50.0, stop=48.0),
        case("2", equity=25000.0, risk_frac=0.02, entry=100.0, stop=95.0),
        case("3", equity=10000.0, risk_frac=0.01, entry=50.0, stop=47.6),
        case("h1", equity=5000.0, risk_frac=0.01, entry=20.0, stop=19.5),
        case("h2", equity=100000.0, risk_frac=0.005, entry=150.0, stop=143.0),
        case("h3", equity=50000.0, risk_frac=0.02, entry=200.0, stop=190.0),
        case("h4", equity=8000.0, risk_frac=0.01, entry=10.0, stop=9.0),
        case("h5", equity=12000.0, risk_frac=0.03, entry=60.0, stop=57.0),
        case("h6", equity=20000.0, risk_frac=0.01, entry=25.0, stop=24.0),
    ],
    examples=["1", "3"],
    example_notes={"1": "Risking $100 at $2 per share buys 50 shares."},
)

BACKTEST = Spec(
    slug="long-only-backtest-costs",
    fn="backtest",
    statement=[
        "Implement `backtest(closes, signals, cost_bps)` — a long-only backtest with transaction costs. Start with equity `1.0`. On each bar `t >= 1`, if `signals[t - 1] == 1` the strategy was long, so multiply equity by `closes[t] / closes[t - 1]`. Whenever the position changes between `signals[t - 1]` and `signals[t]` (in or out), charge `cost_bps / 10_000` of equity. Return the final equity.",
        "The same signals that look brilliant at zero cost usually die at ten basis points — which is why the /learn backtest chapter has a cost slider. Return the equity rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ len(closes) == len(signals) ≤ 10_000", "signals ∈ {0, 1}", "0 ≤ cost_bps ≤ 100"],
    hints=[
        "Apply the bar's return first, then the cost for any change of position at that bar.",
        "A change is signals[t] != signals[t − 1] — entering AND exiting both pay.",
    ],
    ref="""
def backtest(closes, signals, cost_bps):
    eq = 1.0
    fee = cost_bps / 10000
    for t in range(1, len(closes)):
        if signals[t - 1] == 1:
            eq *= closes[t] / closes[t - 1]
        if signals[t] != signals[t - 1]:
            eq *= 1 - fee
    return round(eq, 4)
""",
    stub_py="""
def backtest(closes: list, signals: list, cost_bps: float) -> float:
    \"\"\"Final equity of a long-only backtest with costs, rounded to 4 dp.\"\"\"
    eq = 1.0
    for t in range(1, len(closes)):
        if signals[t - 1] == 1:
            eq *= closes[t] / closes[t - 1]
        # TODO: charge cost_bps / 10_000 of equity whenever the position changes
    return round(eq, 4)
""",
    cases=[
        case("1", closes=[100.0, 102.0, 101.0, 105.0, 104.0], signals=[1, 1, 0, 1, 0], cost_bps=0.0),
        case("2", closes=[50.0, 51.0, 52.0, 51.0], signals=[1, 1, 1, 1], cost_bps=0.0),
        case("3", closes=[100.0, 102.0, 101.0, 105.0, 104.0], signals=[1, 1, 0, 1, 0], cost_bps=10.0),
        case("h1", closes=[10.0, 11.0, 12.0], signals=[0, 0, 0], cost_bps=0.0),
        case("h2", closes=[200.0, 210.0, 205.0, 215.0], signals=[0, 1, 0, 1], cost_bps=25.0),
        case("h3", closes=[1.0, 0.9, 0.8, 0.9], signals=[1, 0, 1, 0], cost_bps=0.0),
        case("h4", closes=[100.0, 100.0, 100.0], signals=[1, 0, 1], cost_bps=0.0),
        case("h5", closes=[75.0, 76.0, 77.0, 78.0, 79.0], signals=[1, 1, 1, 1, 1], cost_bps=0.0),
        case("h6", closes=[300.0, 290.0, 310.0, 305.0], signals=[0, 1, 1, 0], cost_bps=0.0),
    ],
    examples=["1", "3"],
    dataset="SPY · 2020-01-02 → 2024-12-31 · 1,258 bars",
)

MICRO_PRICE = Spec(
    slug="order-book-micro-price",
    fn="micro_price",
    statement=[
        "Implement `micro_price(bid, ask, bid_size, ask_size)` — the size-weighted fair value from the top of the book: `(ask·bid_size + bid·ask_size) / (bid_size + ask_size)`. A heavy bid pushes the fair value TOWARDS the ask, because the bid is the side less likely to give way.",
        "The mid is where the quotes are; the micro-price is where the next trade probably is. Return it rounded to 4 decimal places.",
    ],
    constraints=["0 < bid < ask", "bid_size, ask_size > 0"],
    hints=[
        "Weight each price by the OTHER side's size.",
        "With equal sizes the micro-price is the mid — which is the only time returning the mid is right.",
    ],
    ref="""
def micro_price(bid, ask, bid_size, ask_size):
    return round((ask * bid_size + bid * ask_size) / (bid_size + ask_size), 4)
""",
    stub_py="""
def micro_price(bid: float, ask: float, bid_size: float, ask_size: float) -> float:
    \"\"\"Size-weighted fair value at the top of the book, rounded to 4 dp.\"\"\"
    # TODO: weight by the opposite side's size — this is just the mid
    return round((bid + ask) / 2, 4)
""",
    cases=[
        case("1", bid=100.0, ask=100.1, bid_size=500.0, ask_size=500.0),
        case("2", bid=49.98, ask=50.02, bid_size=1200.0, ask_size=1200.0),
        case("3", bid=100.0, ask=100.1, bid_size=900.0, ask_size=100.0),
        case("h1", bid=10.0, ask=10.05, bid_size=300.0, ask_size=300.0),
        case("h2", bid=250.0, ask=250.2, bid_size=100.0, ask_size=700.0),
        case("h3", bid=1.0, ask=1.01, bid_size=50.0, ask_size=50.0),
        case("h4", bid=75.5, ask=75.6, bid_size=2000.0, ask_size=2000.0),
        case("h5", bid=300.0, ask=300.05, bid_size=10.0, ask_size=10.0),
        case("h6", bid=20.0, ask=20.02, bid_size=800.0, ask_size=800.0),
    ],
    examples=["1", "3"],
    example_notes={"3": "Nine lots bid, one offered — fair value leans towards the ask."},
)

KILL_SWITCH = Spec(
    slug="drawdown-kill-switch",
    fn="kill_switch",
    statement=[
        "Implement `kill_switch(pnl, limit)` — the daily loss limit as a pure function. `pnl` is the sequence of per-trade profits through the day, `limit` a positive number. Walk the cumulative profit; the moment it is at or below `-limit`, trading halts — and it STAYS halted for the rest of the day, even if later fills bring the total back up. Return a list of `0`/`1` flags, one per trade, `1` meaning halted after that trade.",
        "This is the kill switch in this site's safety settings, reduced to twelve lines. Re-arming on a bounce is how a bad day becomes a terrible one.",
    ],
    constraints=["1 ≤ len(pnl) ≤ 500", "limit > 0"],
    hints=[
        "Track a running total and a boolean that, once set, never resets.",
        "If your flag follows the running total up and down, the switch is re-arming.",
    ],
    ref="""
def kill_switch(pnl, limit):
    total = 0.0
    halted = False
    out = []
    for x in pnl:
        total += x
        if total <= -limit:
            halted = True
        out.append(1 if halted else 0)
    return out
""",
    stub_py="""
def kill_switch(pnl: list, limit: float) -> list:
    \"\"\"1 once the day's loss limit has been hit — and stays 1.\"\"\"
    total = 0.0
    out = []
    for x in pnl:
        total += x
        # TODO: once halted, stay halted — this re-arms when the total recovers
        out.append(1 if total <= -limit else 0)
    return out
""",
    cases=[
        case("1", pnl=[-100.0, -150.0, -300.0, -50.0], limit=500.0),
        case("2", pnl=[50.0, -20.0, 30.0, -10.0], limit=200.0),
        case("3", pnl=[-300.0, -250.0, 400.0, 100.0], limit=500.0),
        case("h1", pnl=[-600.0, 50.0, -20.0], limit=500.0),
        case("h2", pnl=[-100.0, -100.0, -100.0, 250.0, -20.0], limit=300.0),
        case("h3", pnl=[10.0, 20.0, 30.0], limit=100.0),
        case("h4", pnl=[-500.0], limit=500.0),
        case("h5", pnl=[-200.0, -200.0, -200.0, -200.0], limit=500.0),
        case("h6", pnl=[100.0, -700.0, -100.0], limit=500.0),
    ],
    examples=["1", "3"],
    example_notes={"3": "The limit is hit on trade 2; the 400 win on trade 3 does not un-halt the day."},
)

WHEEL = Spec(
    slug="wheel-cash-flow-ledger",
    fn="wheel_ledger",
    statement=[
        "Implement `wheel_ledger(events)` — the net cash of a wheel campaign. Events are lists: `[\"put\", premium]` (sold a put, receive premium), `[\"assign\", strike, shares]` (put assigned, pay `strike·shares`), `[\"call\", premium]` (sold a covered call, receive premium), `[\"called_away\", strike, shares]` (shares called away, receive `strike·shares`). Sum every flow.",
        "The wheel is premium in, stock in, premium in, stock out — a ledger, not a strategy, until you can add it up. The workbench's wheel bot backtests exactly these flows. Return the net cash rounded to 4 decimal places.",
    ],
    constraints=["1 ≤ len(events) ≤ 200", "event names are exactly the four above"],
    hints=[
        "Two events bring cash in, one takes it out, and one brings a lot back in.",
        "Being called away is a sale — receive strike × shares.",
    ],
    ref="""
def wheel_ledger(events):
    cash = 0.0
    for e in events:
        kind = e[0]
        if kind == "put" or kind == "call":
            cash += e[1]
        elif kind == "assign":
            cash -= e[1] * e[2]
        elif kind == "called_away":
            cash += e[1] * e[2]
    return round(cash, 4)
""",
    stub_py="""
def wheel_ledger(events: list) -> float:
    \"\"\"Net cash of a wheel campaign, rounded to 4 dp.\"\"\"
    cash = 0.0
    for e in events:
        kind = e[0]
        if kind == "put" or kind == "call":
            cash += e[1]
        elif kind == "assign":
            cash -= e[1] * e[2]
        # TODO: "called_away" — the shares are sold at the strike, cash comes back
    return round(cash, 4)
""",
    cases=[
        case("1", events=[["put", 150.0], ["put", 120.0]]),
        case("2", events=[["put", 200.0], ["assign", 50.0, 100], ["call", 90.0]]),
        case("3", events=[["put", 200.0], ["assign", 50.0, 100], ["call", 90.0], ["called_away", 52.0, 100]]),
        case("h1", events=[["call", 75.5]]),
        case("h2", events=[["put", 300.0], ["assign", 100.0, 100], ["call", 150.0], ["call", 140.0], ["called_away", 105.0, 100]]),
        case("h3", events=[["put", 80.0], ["put", 85.0], ["assign", 20.0, 200], ["call", 60.0]]),
        case("h4", events=[["put", 0.0]]),
        case("h5", events=[["put", 110.0], ["assign", 30.0, 100]]),
        case("h6", events=[["put", 95.0], ["call", 45.0], ["call", 40.0]]),
    ],
    examples=["1", "3"],
    example_notes={"3": "Assigned at 50, called away at 52 — the shares came back as cash."},
)

THETA = Spec(
    slug="theta-bleed-to-expiry",
    fn="theta_bleed",
    statement=[
        "Implement `theta_bleed(S, K, r, sigma, days, day_count)` — how much a European call loses to time over one day: price it with Black-Scholes at `T = days / day_count` and again at `T = (days - 1) / day_count`, and return `[value_now, value_tomorrow, bleed]` where `bleed = value_now - value_tomorrow`. Use `N` from `statistics.NormalDist`.",
        "Theta is the rent an option buyer pays every night, and it is quoted per calendar day or per trading day depending on who you ask — the `day_count` parameter is that choice. Return the three values rounded to 4 decimal places.",
    ],
    constraints=["0 < S, K ≤ 10_000", "2 ≤ days ≤ 365", "day_count ∈ {252, 365}"],
    hints=[
        "Price twice with T one day apart; the difference is the bleed.",
        "A day is 1 / day_count years — do not hard-code 365.",
    ],
    ref="""
from math import log, sqrt, exp
from statistics import NormalDist
N = NormalDist().cdf

def _call(S, K, T, r, sigma):
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    return S * N(d1) - K * exp(-r * T) * N(d2)

def theta_bleed(S, K, r, sigma, days, day_count):
    now = _call(S, K, days / day_count, r, sigma)
    tomorrow = _call(S, K, (days - 1) / day_count, r, sigma)
    return [round(now, 4), round(tomorrow, 4), round(now - tomorrow, 4)]
""",
    stub_py="""
from math import log, sqrt, exp
from statistics import NormalDist

N = NormalDist().cdf


def _call(S, K, T, r, sigma):
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    return S * N(d1) - K * exp(-r * T) * N(d2)


def theta_bleed(S: float, K: float, r: float, sigma: float, days: int, day_count: int) -> list:
    \"\"\"[value now, value tomorrow, one-day bleed], rounded to 4 dp.\"\"\"
    # TODO: a day is 1 / day_count years — 365 is hard-coded here
    now = _call(S, K, days / 365, r, sigma)
    tomorrow = _call(S, K, (days - 1) / 365, r, sigma)
    return [round(now, 4), round(tomorrow, 4), round(now - tomorrow, 4)]
""",
    cases=[
        case("1", S=100.0, K=100.0, r=0.05, sigma=0.2, days=30, day_count=365),
        case("2", S=50.0, K=55.0, r=0.02, sigma=0.3, days=10, day_count=365),
        case("3", S=100.0, K=100.0, r=0.05, sigma=0.2, days=30, day_count=252),
        case("h1", S=200.0, K=190.0, r=0.03, sigma=0.25, days=60, day_count=365),
        case("h2", S=100.0, K=105.0, r=0.04, sigma=0.35, days=21, day_count=252),
        case("h3", S=100.0, K=100.0, r=0.0, sigma=0.5, days=2, day_count=365),
        case("h4", S=80.0, K=75.0, r=0.01, sigma=0.2, days=90, day_count=365),
        case("h5", S=100.0, K=120.0, r=0.05, sigma=0.4, days=45, day_count=365),
        case("h6", S=300.0, K=300.0, r=0.045, sigma=0.18, days=7, day_count=365),
    ],
    examples=["1", "3"],
    example_notes={"3": "Same option, quoted on a 252-day year: the bleed per day is larger."},
)

TRADING = [VWAP, KELLY, SMA_CROSS, DONCHIAN, POSITION_SIZE, BACKTEST, MICRO_PRICE, KILL_SWITCH, WHEEL, THETA]
