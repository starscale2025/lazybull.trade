"""Maths track — nine problems."""

from common import Spec, case

NORMAL_CDF = Spec(
    slug="normal-cdf",
    fn="norm_cdf",
    statement=[
        "Implement `norm_cdf(x)` — the standard normal CDF Φ(x) with the Abramowitz–Stegun 26.2.17 approximation, no libraries: for `x >= 0`, `t = 1 / (1 + 0.2316419·x)` and `Φ = 1 - φ(x)·(b1·t + b2·t² + b3·t³ + b4·t⁴ + b5·t⁵)` with `b = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429]` and `φ` the standard normal density. For negative `x` use symmetry: `Φ(x) = 1 - Φ(-x)`.",
        "This one polynomial is why the workbench prices a whole options chain in under a hundred milliseconds — it is the CDF inside `lib/pricing.ts`. Return Φ rounded to 6 decimal places.",
    ],
    constraints=["-8 ≤ x ≤ 8"],
    hints=[
        "The approximation is only valid for non-negative x.",
        "For x below zero, reflect: Φ(x) = 1 − Φ(−x).",
    ],
    ref="""
from math import exp, pi, sqrt

def norm_cdf(x):
    if x < 0:
        return round(1 - norm_cdf(-x), 6)
    t = 1 / (1 + 0.2316419 * x)
    poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    pdf = exp(-0.5 * x * x) / sqrt(2 * pi)
    return round(1 - pdf * poly, 6)
""",
    stub_py="""
from math import exp, pi, sqrt


def norm_cdf(x: float) -> float:
    \"\"\"Standard normal CDF by Abramowitz–Stegun 26.2.17, rounded to 6 dp.\"\"\"
    # TODO: the polynomial is only valid for x >= 0 — reflect negative x
    t = 1 / (1 + 0.2316419 * x)
    poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    pdf = exp(-0.5 * x * x) / sqrt(2 * pi)
    return round(1 - pdf * poly, 6)
""",
    cases=[
        case("1", x=0.0),
        case("2", x=1.0),
        case("3", x=-1.0),
        case("h1", x=1.96),
        case("h2", x=-0.5),
        case("h3", x=0.35),
        case("h4", x=2.5),
        case("h5", x=0.15),
        case("h6", x=3.0),
    ],
    examples=["2", "3"],
    example_notes={"3": "Φ(−1) must equal 1 − Φ(1)."},
)

RETURNS = Spec(
    slug="log-vs-simple-returns",
    fn="returns",
    statement=[
        "Implement `returns(prices, kind)` — the per-period returns of a price series: `kind = \"simple\"` gives `p_t / p_{t-1} - 1`, `kind = \"log\"` gives `ln(p_t / p_{t-1})`. The list is one shorter than the prices.",
        "Log returns add across time; simple returns add across a portfolio. Confusing the two is how a backtest gains a percent a year out of thin air. Return the values rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ len(prices) ≤ 10_000", "every price > 0", "kind ∈ {simple, log}"],
    hints=[
        "Both start from the same ratio p_t / p_{t−1}.",
        "The log variant takes the natural log of that ratio instead of subtracting one.",
    ],
    ref="""
from math import log

def returns(prices, kind):
    out = []
    for a, b in zip(prices[:-1], prices[1:]):
        ratio = b / a
        out.append(round(log(ratio) if kind == "log" else ratio - 1, 4))
    return out
""",
    stub_py="""
from math import log


def returns(prices: list, kind: str) -> list:
    \"\"\"Simple or log returns, one per step, rounded to 4 dp.\"\"\"
    out = []
    for a, b in zip(prices[:-1], prices[1:]):
        ratio = b / a
        # TODO: kind == "log" is not handled — every call returns simple returns
        out.append(round(ratio - 1, 4))
    return out
""",
    cases=[
        case("1", prices=[100.0, 101.0, 99.0, 102.0], kind="simple"),
        case("2", prices=[50.0, 55.0, 44.0], kind="simple"),
        case("3", prices=[100.0, 101.0, 99.0, 102.0], kind="log"),
        case("h1", prices=[10.0, 10.0, 10.0], kind="simple"),
        case("h2", prices=[200.0, 220.0, 198.0, 217.8], kind="log"),
        case("h3", prices=[1.0, 2.0, 4.0, 8.0], kind="simple"),
        case("h4", prices=[75.0, 70.0, 77.0], kind="simple"),
        case("h5", prices=[300.0, 303.0, 306.03], kind="simple"),
        case("h6", prices=[20.0, 19.0, 21.0, 20.5], kind="simple"),
    ],
    examples=["1", "3"],
)

GBM = Spec(
    slug="gbm-path",
    fn="gbm_path",
    statement=[
        "Implement `gbm_path(S0, mu, sigma, dt, steps, seed)` — a geometric Brownian motion path. Call `random.seed(seed)`, then for each step draw `z = random.gauss(0, 1)` and set `S = S·exp((mu - sigma²/2)·dt + sigma·sqrt(dt)·z)`. Return the `steps` simulated prices (not including `S0`).",
        "It is the null model every option price and every Monte Carlo VaR in the workbench is built on. Return the prices rounded to 4 decimal places.",
    ],
    constraints=["S0 > 0", "0 < dt ≤ 1", "1 ≤ steps ≤ 252"],
    hints=[
        "Drift scales with dt; the shock scales with the square root of dt.",
        "When dt = 1 the two are the same, which is why a daily-sized dt exposes the bug.",
    ],
    ref="""
import random
from math import exp, sqrt

def gbm_path(S0, mu, sigma, dt, steps, seed):
    random.seed(seed)
    s = S0
    out = []
    for _ in range(steps):
        z = random.gauss(0, 1)
        s = s * exp((mu - 0.5 * sigma ** 2) * dt + sigma * sqrt(dt) * z)
        out.append(round(s, 4))
    return out
""",
    stub_py="""
import random
from math import exp


def gbm_path(S0: float, mu: float, sigma: float, dt: float, steps: int, seed: int) -> list:
    \"\"\"GBM prices after each step, rounded to 4 dp.\"\"\"
    random.seed(seed)
    s = S0
    out = []
    for _ in range(steps):
        z = random.gauss(0, 1)
        # TODO: the shock scales with sqrt(dt), not dt
        s = s * exp((mu - 0.5 * sigma ** 2) * dt + sigma * dt * z)
        out.append(round(s, 4))
    return out
""",
    cases=[
        case("1", S0=100.0, mu=0.05, sigma=0.2, dt=1.0, steps=4, seed=7),
        case("2", S0=50.0, mu=0.0, sigma=0.3, dt=1.0, steps=3, seed=1),
        case("3", S0=100.0, mu=0.05, sigma=0.2, dt=0.25, steps=4, seed=7),
        case("h1", S0=10.0, mu=0.1, sigma=0.1, dt=1.0, steps=5, seed=3),
        case("h2", S0=100.0, mu=0.0, sigma=0.25, dt=0.004, steps=5, seed=11),
        case("h3", S0=200.0, mu=0.02, sigma=0.15, dt=1.0, steps=2, seed=5),
        case("h4", S0=1.0, mu=0.0, sigma=0.5, dt=1.0, steps=6, seed=9),
        case("h5", S0=75.0, mu=0.08, sigma=0.2, dt=1.0, steps=3, seed=2),
        case("h6", S0=1000.0, mu=0.03, sigma=0.12, dt=1.0, steps=4, seed=4),
    ],
    examples=["1", "3"],
)

CHOLESKY = Spec(
    slug="cholesky-correlated-shocks",
    fn="cholesky",
    statement=[
        "Implement `cholesky(a)` — the lower-triangular Cholesky factor `L` of a symmetric positive-definite matrix given as a list of rows, so that `L·Lᵀ = a`: `L[i][i] = sqrt(a[i][i] - Σ_k<i L[i][k]²)` and, for `j < i`, `L[i][j] = (a[i][j] - Σ_k<j L[i][k]·L[j][k]) / L[j][j]`. Entries above the diagonal are 0.",
        "Multiply `L` by a vector of independent normals and you get correlated shocks — the way a multi-asset Monte Carlo, or a Heston simulation, breathes together. Return `L` with every entry rounded to 4 decimal places.",
    ],
    constraints=["2 ≤ n ≤ 6", "a is symmetric positive-definite"],
    hints=[
        "Work row by row, left to right; every entry only needs entries already computed.",
        "The off-diagonal formula subtracts the products of earlier entries in BOTH rows — a 2×2 never needs that term, a 3×3 does.",
    ],
    ref="""
from math import sqrt

def cholesky(a):
    n = len(a)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                L[i][j] = sqrt(a[i][i] - s)
            else:
                L[i][j] = (a[i][j] - s) / L[j][j]
    return [[round(v, 4) for v in row] for row in L]
""",
    stub_py="""
from math import sqrt


def cholesky(a: list) -> list:
    \"\"\"Lower-triangular L with L·Lᵀ = a, entries rounded to 4 dp.\"\"\"
    n = len(a)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            if i == j:
                s = sum(L[i][k] ** 2 for k in range(j))
                L[i][j] = sqrt(a[i][i] - s)
            else:
                # TODO: subtract sum(L[i][k] * L[j][k] for k < j) — needed from 3×3 up
                L[i][j] = a[i][j] / L[j][j]
    return [[round(v, 4) for v in row] for row in L]
""",
    cases=[
        case("1", a=[[4.0, 2.0], [2.0, 3.0]]),
        case("2", a=[[1.0, 0.5], [0.5, 1.0]]),
        case("3", a=[[4.0, 2.0, 0.6], [2.0, 2.0, 0.5], [0.6, 0.5, 1.0]]),
        case("h1", a=[[9.0, 3.0], [3.0, 5.0]]),
        case("h2", a=[[1.0, 0.3, 0.2], [0.3, 1.0, 0.4], [0.2, 0.4, 1.0]]),
        case("h3", a=[[2.0, 0.0, 0.5], [0.0, 3.0, 0.7], [0.5, 0.7, 4.0]]),
        case("h4", a=[[16.0, 4.0], [4.0, 10.0]]),
        case("h5", a=[[1.0, 0.0], [0.0, 1.0]]),
        case("h6", a=[[6.25, 1.0, 0.0], [1.0, 4.0, 1.5], [0.0, 1.5, 2.25]]),
    ],
    examples=["1", "3"],
)

NEWTON = Spec(
    slug="newton-method-root",
    fn="newton",
    statement=[
        "Implement `newton(coeffs, x0, tol, max_iter)` — Newton's method for a root of the polynomial with coefficients `coeffs` (highest power first). Iterate `x ← x - f(x) / f'(x)` from `x0` until `|f(x)| < tol` or `max_iter` steps have run. If the derivative is exactly zero at any point, there is no step to take — return `None`.",
        "The implied-vol solver, the yield solver and the Kelly optimiser are all this loop wearing different hats. Return `[root, iterations]` with the root rounded to 6 decimal places.",
    ],
    constraints=["2 ≤ len(coeffs) ≤ 8", "1 ≤ max_iter ≤ 100", "tol > 0"],
    hints=[
        "Evaluate f and f′ with Horner's rule; the derivative's coefficients are coeff × power.",
        "A zero derivative means a division by zero — guard it and return None instead of crashing.",
    ],
    ref="""
def _eval(coeffs, x):
    f = 0.0
    for c in coeffs:
        f = f * x + c
    return f

def _deriv(coeffs):
    n = len(coeffs) - 1
    return [c * (n - i) for i, c in enumerate(coeffs[:-1])]

def newton(coeffs, x0, tol, max_iter):
    d = _deriv(coeffs)
    x = x0
    it = 0
    while it < max_iter and abs(_eval(coeffs, x)) >= tol:
        slope = _eval(d, x)
        if slope == 0:
            return None
        x = x - _eval(coeffs, x) / slope
        it += 1
    return [round(x, 6), it]
""",
    stub_py="""
def _eval(coeffs, x):
    f = 0.0
    for c in coeffs:
        f = f * x + c
    return f


def _deriv(coeffs):
    n = len(coeffs) - 1
    return [c * (n - i) for i, c in enumerate(coeffs[:-1])]


def newton(coeffs: list, x0: float, tol: float, max_iter: int):
    \"\"\"[root to 6 dp, iterations], or None when the derivative vanishes.\"\"\"
    d = _deriv(coeffs)
    x = x0
    it = 0
    while it < max_iter and abs(_eval(coeffs, x)) >= tol:
        # TODO: a zero derivative has no Newton step — return None instead of dividing by it
        x = x - _eval(coeffs, x) / _eval(d, x)
        it += 1
    return [round(x, 6), it]
""",
    cases=[
        case("1", coeffs=[1.0, 0.0, -2.0], x0=1.0, tol=1e-10, max_iter=50),
        case("2", coeffs=[1.0, -3.0, 2.0], x0=3.0, tol=1e-10, max_iter=50),
        case("3", coeffs=[1.0, 0.0, -2.0], x0=0.0, tol=1e-10, max_iter=50),
        case("h1", coeffs=[1.0, 0.0, 0.0, -27.0], x0=2.0, tol=1e-9, max_iter=50),
        case("h2", coeffs=[1.0, 0.0, -9.0], x0=0.0, tol=1e-9, max_iter=50),
        case("h3", coeffs=[2.0, -5.0], x0=0.0, tol=1e-9, max_iter=10),
        case("h4", coeffs=[1.0, 0.0, -9.0], x0=5.0, tol=1e-8, max_iter=50),
        case("h5", coeffs=[1.0, 1.0, -6.0], x0=1.0, tol=1e-10, max_iter=50),
        case("h6", coeffs=[1.0, 0.0, 0.0, -8.0], x0=1.0, tol=1e-9, max_iter=50),
    ],
    examples=["1", "3"],
    example_notes={"3": "x0 = 0 sits on the minimum of x² − 2: the derivative is zero, so there is no step."},
)

PORTFOLIO_VAR = Spec(
    slug="portfolio-variance",
    fn="portfolio_variance",
    statement=[
        "Implement `portfolio_variance(w, cov)` — `wᵀ·Σ·w` for a weight vector `w` and a covariance matrix `cov` given as a list of rows: the double sum over `i, j` of `w[i]·w[j]·cov[i][j]`.",
        "Diversification lives entirely in the off-diagonal terms; a risk model that only adds up variances has no idea two positions can hedge each other. Return the variance rounded to 6 decimal places.",
    ],
    constraints=["1 ≤ n ≤ 20", "cov is symmetric"],
    hints=[
        "Two nested loops over i and j — every pair, not just i == j.",
        "If the off-diagonals are all zero the shortcut works; with correlation it does not.",
    ],
    ref="""
def portfolio_variance(w, cov):
    n = len(w)
    total = 0.0
    for i in range(n):
        for j in range(n):
            total += w[i] * w[j] * cov[i][j]
    return round(total, 6)
""",
    stub_py="""
def portfolio_variance(w: list, cov: list) -> float:
    \"\"\"w^T Σ w, rounded to 6 dp.\"\"\"
    total = 0.0
    for i in range(len(w)):
        # TODO: the cross terms w[i]·w[j]·cov[i][j] for j != i are missing
        total += w[i] * w[i] * cov[i][i]
    return round(total, 6)
""",
    cases=[
        case("1", w=[0.6, 0.4], cov=[[0.04, 0.0], [0.0, 0.09]]),
        case("2", w=[0.5, 0.3, 0.2], cov=[[0.01, 0.0, 0.0], [0.0, 0.04, 0.0], [0.0, 0.0, 0.0225]]),
        case("3", w=[0.6, 0.4], cov=[[0.04, 0.012], [0.012, 0.09]]),
        case("h1", w=[1.0], cov=[[0.0625]]),
        case("h2", w=[0.5, 0.5], cov=[[0.04, -0.03], [-0.03, 0.04]]),
        case("h3", w=[0.25, 0.75], cov=[[0.16, 0.0], [0.0, 0.01]]),
        case("h4", w=[0.2, 0.3, 0.5], cov=[[0.02, 0.0, 0.0], [0.0, 0.03, 0.0], [0.0, 0.0, 0.05]]),
        case("h5", w=[0.7, 0.3], cov=[[0.09, 0.0], [0.0, 0.0]]),
        case("h6", w=[0.5, 0.5], cov=[[0.01, 0.0], [0.0, 0.01]]),
    ],
    examples=["1", "3"],
    example_notes={"3": "Same weights and variances, now with a positive covariance — the answer must rise."},
)

BARRIER = Spec(
    slug="barrier-touch-probability",
    fn="touch_probability",
    statement=[
        "Implement `touch_probability(S, B, T, r, sigma)` — the probability that a geometric Brownian motion starting at `S` touches an upper barrier `B > S` at some point before `T`, under risk-neutral drift. With `m = ln(B / S)`, `nu = r - sigma²/2` and `s = sigma·sqrt(T)`, the reflection principle gives `P = Φ((-m + nu·T) / s) + (B / S)^(2·nu / sigma²)·Φ((-m - nu·T) / s)`. Use `statistics.NormalDist().cdf` for Φ.",
        "This is the probability behind every knock-in, every stop-loss and the /learn probability chapter's third way. Return `P` rounded to 4 decimal places.",
    ],
    constraints=["0 < S < B", "0 < T ≤ 5", "0 ≤ r ≤ 0.2", "0.01 ≤ sigma ≤ 2"],
    hints=[
        "There are two terms: the direct one and the reflected one, weighted by (B/S) to a power.",
        "The driftless shortcut 2·Φ(−m / s) is only right when r equals sigma²/2 exactly.",
    ],
    ref="""
from math import log, sqrt
from statistics import NormalDist
N = NormalDist().cdf

def touch_probability(S, B, T, r, sigma):
    m = log(B / S)
    nu = r - 0.5 * sigma ** 2
    s = sigma * sqrt(T)
    p = N((-m + nu * T) / s) + (B / S) ** (2 * nu / sigma ** 2) * N((-m - nu * T) / s)
    return round(p, 4)
""",
    stub_py="""
from math import log, sqrt
from statistics import NormalDist

N = NormalDist().cdf


def touch_probability(S: float, B: float, T: float, r: float, sigma: float) -> float:
    \"\"\"P(GBM touches B before T), rounded to 4 dp.\"\"\"
    m = log(B / S)
    s = sigma * sqrt(T)
    # TODO: this is the driftless reflection formula — add the drift term nu = r - sigma²/2
    return round(2 * N(-m / s), 4)
""",
    cases=[
        case("1", S=100.0, B=110.0, T=1.0, r=0.02, sigma=0.2),
        case("2", S=50.0, B=60.0, T=0.5, r=0.045, sigma=0.3),
        case("3", S=100.0, B=110.0, T=1.0, r=0.05, sigma=0.2),
        case("h1", S=100.0, B=120.0, T=2.0, r=0.0125, sigma=0.158113883),
        case("h2", S=100.0, B=105.0, T=0.25, r=0.0, sigma=0.25),
        case("h3", S=200.0, B=230.0, T=1.0, r=0.005, sigma=0.1),
        case("h4", S=100.0, B=101.0, T=1.0, r=0.045, sigma=0.3),
        case("h5", S=80.0, B=100.0, T=1.0, r=0.08, sigma=0.4),
        case("h6", S=100.0, B=150.0, T=1.0, r=0.02, sigma=0.2),
    ],
    examples=["1", "3"],
    example_notes={"1": "Here r = sigma²/2 exactly, so the drift term vanishes."},
)

EXPECTED_VALUE = Spec(
    slug="expected-value-bet",
    fn="expected_value",
    statement=[
        "Implement `expected_value(outcomes, stake)` — the expected profit of a bet: `outcomes` is a list of `[probability, payout]` pairs (gross payout received in that outcome), `stake` is what you pay to play. Expected profit is `Σ p·payout - stake`.",
        "Positive expected value is necessary and nowhere near sufficient — the next problem in the track, Kelly, is about how much of it you can afford to bet. Return the value rounded to 4 decimal places.",
    ],
    constraints=["probabilities sum to 1", "stake ≥ 0", "1 ≤ len(outcomes) ≤ 20"],
    hints=[
        "Weight each payout by its probability and add them up.",
        "The stake is paid in every outcome — subtract it once.",
    ],
    ref="""
def expected_value(outcomes, stake):
    ev = sum(p * payout for p, payout in outcomes)
    return round(ev - stake, 4)
""",
    stub_py="""
def expected_value(outcomes: list, stake: float) -> float:
    \"\"\"Expected profit: sum of p × payout, minus the stake. 4 dp.\"\"\"
    ev = sum(p * payout for p, payout in outcomes)
    # TODO: the stake is paid whatever happens — it has not been subtracted
    return round(ev, 4)
""",
    cases=[
        case("1", outcomes=[[0.5, 2.0], [0.5, 0.0]], stake=0.0),
        case("2", outcomes=[[0.2, 10.0], [0.8, 0.0]], stake=0.0),
        case("3", outcomes=[[0.5, 2.0], [0.5, 0.0]], stake=1.1),
        case("h1", outcomes=[[1.0, 3.0]], stake=0.0),
        case("h2", outcomes=[[0.25, 5.0], [0.75, 0.5]], stake=1.5),
        case("h3", outcomes=[[0.1, 100.0], [0.9, 0.0]], stake=0.0),
        case("h4", outcomes=[[0.6, 1.5], [0.4, 0.2]], stake=0.0),
        case("h5", outcomes=[[0.333, 3.0], [0.667, 0.0]], stake=0.0),
        case("h6", outcomes=[[0.5, 1.0], [0.3, 2.0], [0.2, 0.0]], stake=0.0),
    ],
    examples=["1", "3"],
    example_notes={"3": "A fair coin paying 2 for a 1.10 stake loses 0.10 a play."},
)

AUTOCORR = Spec(
    slug="autocorrelation-lag-k",
    fn="autocorr",
    statement=[
        "Implement `autocorr(x, k)` — the lag-`k` sample autocorrelation: with `m` the mean of the whole series, `Σ_{t=k}^{n-1} (x_t - m)(x_{t-k} - m)` divided by `Σ_{t=0}^{n-1} (x_t - m)²`.",
        "It is the first thing to compute before believing a signal: if today's return does not remember yesterday's, most of technical analysis has nothing to hold on to. Return the value rounded to 4 decimal places.",
    ],
    constraints=["k + 2 ≤ len(x) ≤ 10_000", "x is not constant"],
    hints=[
        "Both the numerator and the denominator use deviations from the SAME full-series mean.",
        "Skipping the mean only works when the series already averages to zero.",
    ],
    ref="""
def autocorr(x, k):
    n = len(x)
    m = sum(x) / n
    num = sum((x[t] - m) * (x[t - k] - m) for t in range(k, n))
    den = sum((v - m) ** 2 for v in x)
    return round(num / den, 4)
""",
    stub_py="""
def autocorr(x: list, k: int) -> float:
    \"\"\"Lag-k autocorrelation, rounded to 4 dp.\"\"\"
    n = len(x)
    # TODO: demean the series first — deviations from the mean, not raw values
    num = sum(x[t] * x[t - k] for t in range(k, n))
    den = sum(v * v for v in x)
    return round(num / den, 4)
""",
    cases=[
        case("1", x=[0.01, -0.01, 0.02, -0.02, 0.015, -0.015], k=1),
        case("2", x=[1.0, -1.0, 2.0, -2.0, 1.0, -1.0], k=2),
        case("3", x=[0.01, 0.02, 0.015, 0.03, 0.025, 0.02], k=1),
        case("h1", x=[0.5, -0.5, 0.5, -0.5, 0.5, -0.5], k=1),
        case("h2", x=[100.0, 101.0, 102.0, 101.0, 100.0, 99.0], k=1),
        case("h3", x=[0.02, -0.01, -0.01, 0.03, -0.02, -0.01], k=1),
        case("h4", x=[1.0, 2.0, -3.0, 1.0, 2.0, -3.0], k=3),
        case("h5", x=[0.004, -0.004, 0.002, -0.002, 0.001, -0.001], k=2),
        case("h6", x=[3.0, -1.0, -2.0, 1.0, -1.0, 0.0], k=1),
    ],
    examples=["1", "3"],
)

MATHS = [NORMAL_CDF, RETURNS, GBM, CHOLESKY, NEWTON, PORTFOLIO_VAR, BARRIER, EXPECTED_VALUE, AUTOCORR]
