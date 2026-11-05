"""Finance track — ten problems."""

from math import exp, log, sqrt
from statistics import NormalDist

from common import Spec, case

_N = NormalDist().cdf


def _bs_call(S, K, T, r, sigma):
    d1 = (log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    return S * _N(d1) - K * exp(-r * T) * _N(d2)


def _bs_put(S, K, T, r, sigma):
    return _bs_call(S, K, T, r, sigma) - S + K * exp(-r * T)


BLACK_SCHOLES = Spec(
    slug="black-scholes-call",
    fn="call_price",
    statement=[
        "Implement `call_price(S, K, T, r, sigma)` — the Black-Scholes price of a European call on a non-dividend stock: spot `S`, strike `K`, time to expiry `T` in years, continuously compounded rate `r`, volatility `sigma`. Use the standard normal CDF `N` from `statistics.NormalDist`.",
        "This is the formula every options desk still reaches for first, and the one the workbench's Black-Scholes bot runs on every chain. Get the discounting right: the strike is paid at expiry, so it is worth less today.",
        "Return the price rounded to 4 decimal places.",
    ],
    constraints=["0 < S, K ≤ 10_000", "0 < T ≤ 5", "0 ≤ r ≤ 0.2", "0.01 ≤ sigma ≤ 2"],
    hints=[
        "There are two terms: what you receive (the stock, weighted by N(d1)) and what you pay (the strike, weighted by N(d2)).",
        "You pay the strike at expiry, not today. What is a payment of K in T years worth now at rate r?",
        "Multiply the strike term by exp(-r * T). With r = 0 nothing changes, which is why the first two cases already pass.",
    ],
    ref="""
from math import log, sqrt, exp
from statistics import NormalDist
N = NormalDist().cdf

def call_price(S, K, T, r, sigma):
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    return round(S * N(d1) - K * exp(-r * T) * N(d2), 4)
""",
    stub_py="""
from math import log, sqrt, exp
from statistics import NormalDist

N = NormalDist().cdf


def call_price(S: float, K: float, T: float, r: float, sigma: float) -> float:
    \"\"\"European call, no dividends. Return the price rounded to 4 dp.\"\"\"
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    # TODO: the strike leg is paid at expiry — it is not discounted yet
    return round(S * N(d1) - K * N(d2), 4)
""",
    stub_ts="""
// Abramowitz & Stegun 26.2.17 — the same constants as lib/pricing.ts.
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - (Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

/** European call, no dividends. Returns the price rounded to 4 dp. */
export function callPrice(S: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  // TODO: the strike leg is paid at expiry — it is not discounted yet
  return Math.round((S * normCdf(d1) - K * normCdf(d2)) * 1e4) / 1e4;
}
""",
    cases=[
        case("1", S=100.0, K=100.0, T=1.0, r=0.0, sigma=0.2),
        case("2", S=100.0, K=90.0, T=0.5, r=0.0, sigma=0.25),
        case("3", S=100.0, K=100.0, T=1.0, r=0.05, sigma=0.2),
        case("h1", S=50.0, K=55.0, T=2.0, r=0.0, sigma=0.3),
        case("h2", S=120.0, K=100.0, T=0.25, r=0.04, sigma=0.18),
        case("h3", S=100.0, K=110.0, T=1.0, r=0.0, sigma=0.15),
        case("h4", S=80.0, K=75.0, T=1.5, r=0.0, sigma=0.22),
        case("h5", S=100.0, K=100.0, T=0.1, r=0.0, sigma=0.4),
        case("h6", S=200.0, K=210.0, T=1.0, r=0.0, sigma=0.35),
    ],
    examples=["1", "3"],
    example_notes={"3": "With r = 5% the strike is discounted; the undiscounted price would read 7.7213."},
    dataset="AAPL chain · 2024-03-15 expiry · 41 strikes",
    editorial=[
        "A European call pays max(S_T − K, 0) at expiry. Under the risk-neutral measure the stock grows at r, so the price is the discounted expectation of that payoff. Black and Scholes solved the expectation in closed form: C = S·N(d1) − K·e^(−rT)·N(d2), with d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T) and d2 = d1 − σ√T.",
        "Read the two terms as two probabilities. N(d2) is the risk-neutral probability the option finishes in the money, so K·e^(−rT)·N(d2) is the present value of what you expect to pay. S·N(d1) is the present value of the stock you expect to receive — N(d1) is larger than N(d2) because it is weighted by how far in the money you finish.",
        "Three ways people get it wrong. Forgetting the discount factor on the strike (the untouched stub): harmless when r = 0, which is exactly why the first two cases pass and the third does not. Using σ·T instead of σ·√T in the denominator. And plugging in an annualised rate with a T in days.",
        "The workbench's Black-Scholes bot runs this formula across every strike on the chain in under a hundred milliseconds — it is a polynomial CDF, not a simulation — and the Greeks page differentiates it. Same formula, four surfaces.",
    ],
)

PUT_CALL_PARITY = Spec(
    slug="put-call-parity",
    fn="parity_gap",
    statement=[
        "Implement `parity_gap(call, put, S, K, T, r)` — the arbitrage gap in put-call parity for European options on a non-dividend stock: `C - P - (S - K·e^(-rT))`. A perfectly priced pair returns 0.",
        "Parity is the first sanity check a desk runs on a chain: if the gap is not zero, one of the quotes is stale or somebody is offering free money. Return the gap rounded to 4 decimal places.",
    ],
    constraints=["0 < S, K ≤ 10_000", "0 < T ≤ 5", "0 ≤ r ≤ 0.2"],
    hints=[
        "Parity compares a call minus a put with a stock minus a bond that pays K at expiry.",
        "A bond paying K in T years is worth K·exp(-r·T) today — discount the strike.",
    ],
    ref="""
from math import exp

def parity_gap(call, put, S, K, T, r):
    return round(call - put - (S - K * exp(-r * T)), 4)
""",
    stub_py="""
from math import exp


def parity_gap(call: float, put: float, S: float, K: float, T: float, r: float) -> float:
    \"\"\"C - P - (S - PV(K)), rounded to 4 dp. Zero means no arbitrage.\"\"\"
    # TODO: PV(K) is the strike discounted at r over T, not the strike itself
    pv_strike = K
    return round(call - put - (S - pv_strike), 4)
""",
    cases=[
        case("1", call=7.9656, put=7.9656, S=100.0, K=100.0, T=1.0, r=0.0),
        case("2", call=12.3, put=2.3, S=100.0, K=90.0, T=0.5, r=0.0),
        case("3", call=10.4506, put=5.5735, S=100.0, K=100.0, T=1.0, r=0.05),
        case("h1", call=3.1, put=8.1, S=50.0, K=55.0, T=2.0, r=0.0),
        case("h2", call=21.02, put=0.03, S=120.0, K=100.0, T=0.25, r=0.04),
        case("h3", call=2.5, put=12.6, S=100.0, K=110.0, T=1.0, r=0.0),
        case("h4", call=9.0, put=4.0, S=80.0, K=75.0, T=1.5, r=0.0),
        case("h5", call=5.04, put=5.04, S=100.0, K=100.0, T=0.1, r=0.0),
        case("h6", call=24.5, put=34.5, S=200.0, K=210.0, T=1.0, r=0.0),
    ],
    examples=["1", "3"],
)

IMPLIED_VOL = Spec(
    slug="implied-vol-bisection",
    fn="implied_vol",
    statement=[
        "Implement `implied_vol(price, S, K, T, r)` — the volatility `sigma` at which the Black-Scholes call price equals the observed `price`. Bisect on `sigma` between 0.01 and 3.0 until the interval is narrower than 1e-8, pricing with `N` from `statistics.NormalDist`.",
        "Quotes come as prices; models think in vols. Inverting the pricer is how every implied-vol surface on every screen gets built, and the workbench's IV solver bot does exactly this — thousands of times per chain.",
        "Return `sigma` rounded to 4 decimal places.",
    ],
    constraints=["price is attainable: 0 < price < S", "0 < T ≤ 5", "0 ≤ r ≤ 0.2"],
    hints=[
        "Call price rises with vol, so if the midpoint prices too high the answer is in the lower half.",
        "Check the pricer you are inverting: the denominator of d1 is sigma times the square root of T, not sigma times T.",
    ],
    ref="""
from math import log, sqrt, exp
from statistics import NormalDist
N = NormalDist().cdf

def _call(S, K, T, r, sigma):
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    return S * N(d1) - K * exp(-r * T) * N(d2)

def implied_vol(price, S, K, T, r):
    lo, hi = 0.01, 3.0
    while hi - lo > 1e-8:
        mid = (lo + hi) / 2
        if _call(S, K, T, r, mid) > price:
            hi = mid
        else:
            lo = mid
    return round((lo + hi) / 2, 4)
""",
    stub_py="""
from math import log, sqrt, exp
from statistics import NormalDist

N = NormalDist().cdf


def _call(S, K, T, r, sigma):
    # TODO: the denominator is sigma * sqrt(T) — this only works when T == 1
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * T)
    d2 = d1 - sigma * sqrt(T)
    return S * N(d1) - K * exp(-r * T) * N(d2)


def implied_vol(price: float, S: float, K: float, T: float, r: float) -> float:
    \"\"\"Bisect sigma in [0.01, 3.0] until the bracket is under 1e-8. 4 dp.\"\"\"
    lo, hi = 0.01, 3.0
    while hi - lo > 1e-8:
        mid = (lo + hi) / 2
        if _call(S, K, T, r, mid) > price:
            hi = mid
        else:
            lo = mid
    return round((lo + hi) / 2, 4)
""",
    cases=[
        case("1", price=round(_bs_call(100, 100, 1.0, 0.05, 0.2), 4), S=100.0, K=100.0, T=1.0, r=0.05),
        case("2", price=round(_bs_call(100, 110, 1.0, 0.02, 0.3), 4), S=100.0, K=110.0, T=1.0, r=0.02),
        case("3", price=round(_bs_call(100, 100, 0.5, 0.05, 0.25), 4), S=100.0, K=100.0, T=0.5, r=0.05),
        case("h1", price=round(_bs_call(50, 45, 1.0, 0.0, 0.4), 4), S=50.0, K=45.0, T=1.0, r=0.0),
        case("h2", price=round(_bs_call(100, 95, 0.25, 0.03, 0.18), 4), S=100.0, K=95.0, T=0.25, r=0.03),
        case("h3", price=round(_bs_call(200, 200, 1.0, 0.04, 0.15), 4), S=200.0, K=200.0, T=1.0, r=0.04),
        case("h4", price=round(_bs_call(100, 120, 1.0, 0.05, 0.35), 4), S=100.0, K=120.0, T=1.0, r=0.05),
        case("h5", price=round(_bs_call(80, 80, 1.0, 0.0, 0.5), 4), S=80.0, K=80.0, T=1.0, r=0.0),
        case("h6", price=round(_bs_call(100, 90, 1.0, 0.01, 0.22), 4), S=100.0, K=90.0, T=1.0, r=0.01),
    ],
    examples=["1", "3"],
    dataset="SPY chain · 2024-06-21 expiry · 96 strikes",
)

BOND = Spec(
    slug="bond-price-duration",
    fn="bond_price_duration",
    statement=[
        "Implement `bond_price_duration(face, coupon_rate, ytm, years, freq)` for a plain fixed-coupon bond: `freq` coupons per year of `face·coupon_rate/freq`, principal at maturity, yield `ytm` compounded `freq` times a year. Return `[price, macaulay_duration]` — duration in years.",
        "Price tells you what it costs; duration tells you how much it moves when yields shift by one percent. Return both rounded to 4 decimal places.",
    ],
    constraints=["face > 0", "0 ≤ coupon_rate, ytm ≤ 0.2", "1 ≤ years ≤ 30", "freq ∈ {1, 2, 4}"],
    hints=[
        "There are years × freq periods; each period discounts at (1 + ytm/freq).",
        "Duration is the PV-weighted average time of the cash flows, in periods — divide by freq to get years.",
    ],
    ref="""
def bond_price_duration(face, coupon_rate, ytm, years, freq):
    n = int(years * freq)
    c = face * coupon_rate / freq
    y = ytm / freq
    price = 0.0
    weighted = 0.0
    for t in range(1, n + 1):
        cf = c + (face if t == n else 0.0)
        pv = cf / (1 + y) ** t
        price += pv
        weighted += t * pv
    duration = weighted / price / freq
    return [round(price, 4), round(duration, 4)]
""",
    stub_py="""
def bond_price_duration(face: float, coupon_rate: float, ytm: float, years: int, freq: int) -> list:
    \"\"\"Return [price, macaulay duration in years], both rounded to 4 dp.\"\"\"
    # TODO: coupons arrive `freq` times a year — periods, coupon and yield all scale
    n = years
    c = face * coupon_rate
    y = ytm
    price = 0.0
    weighted = 0.0
    for t in range(1, n + 1):
        cf = c + (face if t == n else 0.0)
        pv = cf / (1 + y) ** t
        price += pv
        weighted += t * pv
    return [round(price, 4), round(weighted / price, 4)]
""",
    cases=[
        case("1", face=1000.0, coupon_rate=0.05, ytm=0.06, years=5, freq=1),
        case("2", face=100.0, coupon_rate=0.08, ytm=0.08, years=10, freq=1),
        case("3", face=1000.0, coupon_rate=0.05, ytm=0.06, years=5, freq=2),
        case("h1", face=1000.0, coupon_rate=0.0, ytm=0.04, years=3, freq=1),
        case("h2", face=100.0, coupon_rate=0.07, ytm=0.05, years=8, freq=4),
        case("h3", face=500.0, coupon_rate=0.03, ytm=0.02, years=2, freq=1),
        case("h4", face=1000.0, coupon_rate=0.1, ytm=0.12, years=20, freq=1),
        case("h5", face=100.0, coupon_rate=0.045, ytm=0.045, years=7, freq=1),
        case("h6", face=1000.0, coupon_rate=0.06, ytm=0.03, years=1, freq=1),
    ],
    examples=["1", "3"],
)

CAGR = Spec(
    slug="cagr-equity-curve",
    fn="cagr",
    statement=[
        "Implement `cagr(equity, periods_per_year)` — the compound annual growth rate of an equity curve sampled once per period: `(last / first) ** (periods_per_year / (n - 1)) - 1`, where `n` is the number of samples.",
        "A backtest that doubled looks different over two years than over ten. CAGR is how the portfolio page annualises a curve of any length. Return the rate rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ n ≤ 10_000", "every value > 0", "periods_per_year ∈ {12, 52, 252}"],
    hints=[
        "n samples span n − 1 periods.",
        "The exponent is periods_per_year over the number of periods — do not assume the data is daily.",
    ],
    ref="""
def cagr(equity, periods_per_year):
    n = len(equity)
    return round((equity[-1] / equity[0]) ** (periods_per_year / (n - 1)) - 1, 4)
""",
    stub_py="""
def cagr(equity: list, periods_per_year: int) -> float:
    \"\"\"Annualised growth of an equity curve, rounded to 4 dp.\"\"\"
    periods = len(equity) - 1
    # TODO: the curve is not always daily — use periods_per_year
    return round((equity[-1] / equity[0]) ** (252 / periods) - 1, 4)
""",
    cases=[
        case("1", equity=[100.0, 101.0, 103.0, 102.5, 104.0, 106.0], periods_per_year=252),
        case("2", equity=[5000.0, 5100.0, 5050.0, 5200.0, 5400.0], periods_per_year=252),
        case("3", equity=[100.0, 104.0, 103.0, 108.0, 110.0, 112.0, 115.0], periods_per_year=12),
        case("h1", equity=[100.0, 99.0, 98.5, 99.5, 101.0], periods_per_year=252),
        case("h2", equity=[10000.0, 10200.0, 10400.0, 10100.0, 10600.0], periods_per_year=52),
        case("h3", equity=[1.0, 1.0, 1.0, 1.0], periods_per_year=252),
        case("h4", equity=[200.0, 190.0, 180.0, 185.0, 175.0], periods_per_year=252),
        case("h5", equity=[100.0, 110.0], periods_per_year=252),
        case("h6", equity=[50.0, 52.0, 51.0, 55.0, 54.0, 57.0, 60.0, 59.0], periods_per_year=252),
    ],
    examples=["1", "3"],
    dataset="paper account · 2024-01-02 → 2024-12-31 · 252 closes",
)

PV_LADDER = Spec(
    slug="pv-cash-flow-ladder",
    fn="present_value",
    statement=[
        "Implement `present_value(cashflows, rate, terminal)` — the present value of a ladder of cash flows paid at the end of periods 1..n at a flat per-period `rate`, plus a `terminal` amount paid together with the last flow.",
        "Every dividend model, bond and annuity is this loop. Return the value rounded to 4 decimal places.",
    ],
    constraints=["1 ≤ n ≤ 600", "0 ≤ rate ≤ 0.5", "terminal ≥ 0"],
    hints=[
        "The flow at period t is worth cashflows[t-1] / (1 + rate) ** t today.",
        "The terminal amount arrives at period n — discount it with the last flow.",
    ],
    ref="""
def present_value(cashflows, rate, terminal):
    pv = 0.0
    for t, cf in enumerate(cashflows, start=1):
        pv += cf / (1 + rate) ** t
    n = len(cashflows)
    pv += terminal / (1 + rate) ** n
    return round(pv, 4)
""",
    stub_py="""
def present_value(cashflows: list, rate: float, terminal: float) -> float:
    \"\"\"PV of flows at t = 1..n plus a terminal amount at t = n. 4 dp.\"\"\"
    pv = 0.0
    for t, cf in enumerate(cashflows, start=1):
        pv += cf / (1 + rate) ** t
    # TODO: the terminal amount is paid with the last flow and is not discounted in yet
    return round(pv, 4)
""",
    cases=[
        case("1", cashflows=[100.0, 100.0, 100.0], rate=0.05, terminal=0.0),
        case("2", cashflows=[50.0, 60.0, 70.0, 80.0], rate=0.1, terminal=0.0),
        case("3", cashflows=[5.0, 5.0, 5.0, 5.0, 5.0], rate=0.04, terminal=100.0),
        case("h1", cashflows=[1000.0], rate=0.0, terminal=0.0),
        case("h2", cashflows=[2.5, 2.5, 2.5, 2.5], rate=0.03, terminal=100.0),
        case("h3", cashflows=[10.0, 20.0, 30.0], rate=0.2, terminal=0.0),
        case("h4", cashflows=[100.0, 0.0, 0.0, 100.0], rate=0.07, terminal=0.0),
        case("h5", cashflows=[3.0, 3.0, 3.0, 3.0, 3.0, 3.0], rate=0.01, terminal=0.0),
        case("h6", cashflows=[250.0, 250.0], rate=0.12, terminal=0.0),
    ],
    examples=["1", "3"],
)

GREEKS_FD = Spec(
    slug="greeks-finite-difference",
    fn="greeks_fd",
    statement=[
        "Implement `greeks_fd(S, K, T, r, sigma, kind)` — delta, gamma and vega of a European option by central finite differences on the Black-Scholes price: bump `S` by 0.01 for delta and gamma, bump `sigma` by 0.0001 for vega (report vega per unit of `sigma`). `kind` is `\"call\"` or `\"put\"`; price puts with put-call parity.",
        "When the pricer is a black box — a tree, a Monte Carlo, a neural surrogate — this is how you still get Greeks. Return `[delta, gamma, vega]` rounded to 4 decimal places.",
    ],
    constraints=["0 < S, K ≤ 10_000", "0 < T ≤ 5", "0.01 ≤ sigma ≤ 2", "kind ∈ {call, put}"],
    hints=[
        "Central differences: (f(x + h) − f(x − h)) / (2h) for the first derivative, (f(x + h) − 2f(x) + f(x − h)) / h² for the second.",
        "A put is a call minus the stock plus the discounted strike. If your pricer only knows calls, puts come out wrong.",
    ],
    ref="""
from math import log, sqrt, exp
from statistics import NormalDist
N = NormalDist().cdf

def _price(S, K, T, r, sigma, kind):
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    call = S * N(d1) - K * exp(-r * T) * N(d2)
    if kind == "put":
        return call - S + K * exp(-r * T)
    return call

def greeks_fd(S, K, T, r, sigma, kind):
    h = 0.01
    hv = 0.0001
    up = _price(S + h, K, T, r, sigma, kind)
    mid = _price(S, K, T, r, sigma, kind)
    dn = _price(S - h, K, T, r, sigma, kind)
    delta = (up - dn) / (2 * h)
    gamma = (up - 2 * mid + dn) / h ** 2
    vega = (_price(S, K, T, r, sigma + hv, kind) - _price(S, K, T, r, sigma - hv, kind)) / (2 * hv)
    return [round(delta, 4), round(gamma, 4), round(vega, 4)]
""",
    stub_py="""
from math import log, sqrt, exp
from statistics import NormalDist

N = NormalDist().cdf


def _price(S, K, T, r, sigma, kind):
    d1 = (log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    call = S * N(d1) - K * exp(-r * T) * N(d2)
    # TODO: kind == "put" — put-call parity, not the call price
    return call


def greeks_fd(S: float, K: float, T: float, r: float, sigma: float, kind: str) -> list:
    \"\"\"[delta, gamma, vega] by central differences, each rounded to 4 dp.\"\"\"
    h, hv = 0.01, 0.0001
    up = _price(S + h, K, T, r, sigma, kind)
    mid = _price(S, K, T, r, sigma, kind)
    dn = _price(S - h, K, T, r, sigma, kind)
    delta = (up - dn) / (2 * h)
    gamma = (up - 2 * mid + dn) / h ** 2
    vega = (_price(S, K, T, r, sigma + hv, kind) - _price(S, K, T, r, sigma - hv, kind)) / (2 * hv)
    return [round(delta, 4), round(gamma, 4), round(vega, 4)]
""",
    cases=[
        case("1", S=100.0, K=100.0, T=1.0, r=0.05, sigma=0.2, kind="call"),
        case("2", S=100.0, K=110.0, T=0.5, r=0.02, sigma=0.3, kind="call"),
        case("3", S=100.0, K=100.0, T=1.0, r=0.05, sigma=0.2, kind="put"),
        case("h1", S=50.0, K=45.0, T=2.0, r=0.0, sigma=0.4, kind="call"),
        case("h2", S=120.0, K=125.0, T=0.25, r=0.04, sigma=0.18, kind="put"),
        case("h3", S=200.0, K=180.0, T=1.0, r=0.03, sigma=0.15, kind="call"),
        case("h4", S=100.0, K=120.0, T=1.0, r=0.05, sigma=0.35, kind="call"),
        case("h5", S=80.0, K=80.0, T=0.1, r=0.01, sigma=0.5, kind="call"),
        case("h6", S=100.0, K=90.0, T=1.5, r=0.01, sigma=0.22, kind="call"),
    ],
    examples=["1", "3"],
)

AMERICAN_PUT = Spec(
    slug="binomial-american-put",
    fn="american_put",
    statement=[
        "Implement `american_put(S, K, T, r, sigma, steps)` — the price of an American put on a Cox-Ross-Rubinstein binomial tree with `steps` steps: `u = exp(sigma·sqrt(dt))`, `d = 1/u`, risk-neutral `p = (exp(r·dt) - d) / (u - d)`. Roll back from expiry, and at every node take the larger of continuation value and immediate exercise `K - S_node`.",
        "The put is the option where early exercise actually matters, and the tree is the honest way to see it. The workbench's American pricer bot is a neural surrogate trained on exactly this tree. Return the price rounded to 4 decimal places.",
    ],
    constraints=["0 < S, K ≤ 10_000", "0 < T ≤ 5", "0 ≤ r ≤ 0.2", "10 ≤ steps ≤ 500"],
    hints=[
        "Build the terminal payoffs, then discount each pair back one step with p and 1 − p.",
        "At each interior node compare the discounted continuation value with K − S at that node — an American holder takes whichever is larger.",
    ],
    ref="""
from math import exp, sqrt

def american_put(S, K, T, r, sigma, steps):
    dt = T / steps
    u = exp(sigma * sqrt(dt))
    d = 1 / u
    p = (exp(r * dt) - d) / (u - d)
    disc = exp(-r * dt)
    values = [max(K - S * u ** j * d ** (steps - j), 0.0) for j in range(steps + 1)]
    for i in range(steps - 1, -1, -1):
        nxt = []
        for j in range(i + 1):
            cont = disc * (p * values[j + 1] + (1 - p) * values[j])
            spot = S * u ** j * d ** (i - j)
            nxt.append(max(cont, K - spot))
        values = nxt
    return round(values[0], 4)
""",
    stub_py="""
from math import exp, sqrt


def american_put(S: float, K: float, T: float, r: float, sigma: float, steps: int) -> float:
    \"\"\"CRR tree price of an American put, rounded to 4 dp.\"\"\"
    dt = T / steps
    u = exp(sigma * sqrt(dt))
    d = 1 / u
    p = (exp(r * dt) - d) / (u - d)
    disc = exp(-r * dt)
    values = [max(K - S * u ** j * d ** (steps - j), 0.0) for j in range(steps + 1)]
    for i in range(steps - 1, -1, -1):
        nxt = []
        for j in range(i + 1):
            cont = disc * (p * values[j + 1] + (1 - p) * values[j])
            # TODO: an American holder may exercise here — compare with K - S at this node
            nxt.append(cont)
        values = nxt
    return round(values[0], 4)
""",
    cases=[
        case("1", S=100.0, K=100.0, T=1.0, r=0.0, sigma=0.2, steps=50),
        case("2", S=100.0, K=90.0, T=0.5, r=0.0, sigma=0.3, steps=40),
        case("3", S=100.0, K=110.0, T=1.0, r=0.06, sigma=0.2, steps=50),
        case("h1", S=50.0, K=55.0, T=2.0, r=0.0, sigma=0.25, steps=60),
        case("h2", S=80.0, K=100.0, T=1.0, r=0.05, sigma=0.15, steps=50),
        case("h3", S=200.0, K=180.0, T=1.0, r=0.0, sigma=0.35, steps=30),
        case("h4", S=100.0, K=100.0, T=0.25, r=0.0, sigma=0.4, steps=25),
        case("h5", S=120.0, K=120.0, T=1.5, r=0.0, sigma=0.2, steps=45),
        case("h6", S=75.0, K=70.0, T=1.0, r=0.0, sigma=0.3, steps=50),
    ],
    examples=["1", "3"],
    example_notes={"3": "With r = 6% and the put deep in the money, exercising early beats waiting."},
)

COVERED_CALL = Spec(
    slug="covered-call-payoff",
    fn="covered_call_pnl",
    statement=[
        "Implement `covered_call_pnl(entry, strike, premium, expiry_prices)` — the profit per share of a covered call (long stock bought at `entry`, short call at `strike` sold for `premium`) for each price in `expiry_prices`. Above the strike the stock is called away, so the upside is capped.",
        "It is the first options position most people put on, and the cap is the part they forget. The wheel bot in the workbench lives on this payoff. Return the list of profits rounded to 4 decimal places.",
    ],
    constraints=["entry, strike, premium > 0", "1 ≤ len(expiry_prices) ≤ 50"],
    hints=[
        "Below the strike you keep the stock: price − entry + premium.",
        "At or above the strike you deliver at the strike: strike − entry + premium, whatever the price.",
    ],
    ref="""
def covered_call_pnl(entry, strike, premium, expiry_prices):
    return [round(min(px, strike) - entry + premium, 4) for px in expiry_prices]
""",
    stub_py="""
def covered_call_pnl(entry: float, strike: float, premium: float, expiry_prices: list) -> list:
    \"\"\"Profit per share at each expiry price, rounded to 4 dp.\"\"\"
    out = []
    for px in expiry_prices:
        # TODO: above the strike the stock is called away — cap the stock leg at the strike
        out.append(round(px - entry + premium, 4))
    return out
""",
    cases=[
        case("1", entry=100.0, strike=110.0, premium=2.5, expiry_prices=[90.0, 100.0, 105.0, 110.0]),
        case("2", entry=50.0, strike=55.0, premium=1.2, expiry_prices=[45.0, 50.0, 52.5]),
        case("3", entry=100.0, strike=110.0, premium=2.5, expiry_prices=[95.0, 110.0, 120.0, 140.0]),
        case("h1", entry=20.0, strike=25.0, premium=0.8, expiry_prices=[18.0, 22.0, 25.0]),
        case("h2", entry=200.0, strike=210.0, premium=6.0, expiry_prices=[205.0, 215.0, 250.0]),
        case("h3", entry=75.0, strike=80.0, premium=3.0, expiry_prices=[60.0, 70.0, 80.0]),
        case("h4", entry=10.0, strike=12.0, premium=0.5, expiry_prices=[9.0, 11.0]),
        case("h5", entry=150.0, strike=160.0, premium=4.4, expiry_prices=[140.0, 150.0, 155.0, 160.0]),
        case("h6", entry=33.0, strike=35.0, premium=1.0, expiry_prices=[30.0, 35.0]),
    ],
    examples=["1", "3"],
)

MAX_DD = Spec(
    slug="max-drawdown",
    fn="max_drawdown",
    statement=[
        "Implement `max_drawdown(equity)` — the largest peak-to-trough decline of an equity curve as a positive fraction of the peak: the maximum over time of `(running_peak - value) / running_peak`.",
        "It is the number that ends careers before the Sharpe ratio gets a chance to. Note the running peak: a new high resets where the fall is measured from. Return the fraction rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ len(equity) ≤ 10_000", "every value > 0"],
    hints=[
        "Walk the series once, carrying the highest value seen so far.",
        "Measure each point against that running peak, not against the first value.",
    ],
    ref="""
def max_drawdown(equity):
    peak = equity[0]
    worst = 0.0
    for v in equity:
        if v > peak:
            peak = v
        dd = (peak - v) / peak
        if dd > worst:
            worst = dd
    return round(worst, 4)
""",
    stub_py="""
def max_drawdown(equity: list) -> float:
    \"\"\"Largest peak-to-trough fall as a fraction of the peak, 4 dp.\"\"\"
    # TODO: the peak moves — a new high resets where the fall is measured from
    peak = equity[0]
    worst = 0.0
    for v in equity:
        dd = (peak - v) / peak
        if dd > worst:
            worst = dd
    return round(worst, 4)
""",
    cases=[
        case("1", equity=[100.0, 95.0, 90.0, 97.0, 99.0]),
        case("2", equity=[50.0, 48.0, 45.0, 46.0, 44.0, 49.0]),
        case("3", equity=[100.0, 110.0, 120.0, 96.0, 105.0]),
        case("h1", equity=[10.0, 9.0, 8.0, 7.0, 6.0]),
        case("h2", equity=[100.0, 90.0, 130.0, 104.0, 120.0]),
        case("h3", equity=[100.0, 100.0, 100.0]),
        case("h4", equity=[200.0, 150.0, 199.0, 160.0]),
        case("h5", equity=[1000.0, 999.0, 998.0, 999.5]),
        case("h6", equity=[100.0, 80.0, 95.0, 70.0, 90.0]),
    ],
    examples=["1", "3"],
    example_notes={"3": "The peak is 120, not 100 — the fall to 96 is 20%."},
    dataset="AAPL · 2019-01-02 → 2024-12-31 · 1,509 bars",
)

FINANCE = [BLACK_SCHOLES, PUT_CALL_PARITY, IMPLIED_VOL, BOND, CAGR, PV_LADDER, GREEKS_FD, AMERICAN_PUT, COVERED_CALL, MAX_DD]
