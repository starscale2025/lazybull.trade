"""Synthetic data generators using py_vollib as ground-truth oracle."""
from __future__ import annotations
import numpy as np
import py_vollib.black_scholes as bs
import py_vollib.black_scholes.greeks.analytical as greeks
import py_vollib.black_scholes.implied_volatility as ivmod


RNG = np.random.default_rng(42)


def sample_bs_inputs(n: int, rng: np.random.Generator | None = None) -> dict:
    rng = rng or RNG
    moneyness = rng.uniform(0.6, 1.4, n)
    S = np.full(n, 100.0)
    K = S * moneyness
    T = rng.uniform(1 / 365, 2.0, n)
    r = rng.uniform(0.0, 0.08, n)
    sigma = rng.uniform(0.05, 0.8, n)
    flag = rng.choice(['c', 'p'], n)
    return dict(S=S, K=K, T=T, r=r, sigma=sigma, flag=flag)


def bs_targets(inp: dict) -> dict:
    n = len(inp['S'])
    out = {k: np.zeros(n) for k in ['price', 'delta', 'gamma', 'vega', 'theta', 'rho']}
    for i in range(n):
        f, S, K, T, r, s = inp['flag'][i], inp['S'][i], inp['K'][i], inp['T'][i], inp['r'][i], inp['sigma'][i]
        out['price'][i] = bs.black_scholes(f, S, K, T, r, s)
        out['delta'][i] = greeks.delta(f, S, K, T, r, s)
        out['gamma'][i] = greeks.gamma(f, S, K, T, r, s)
        out['vega'][i] = greeks.vega(f, S, K, T, r, s)
        out['theta'][i] = greeks.theta(f, S, K, T, r, s)
        out['rho'][i] = greeks.rho(f, S, K, T, r, s)
    return out


def features_matrix(inp: dict) -> np.ndarray:
    """[S, K, T, r, sigma, is_call, log_moneyness, sqrtT, vol*sqrtT]"""
    S, K, T, r, sigma = inp['S'], inp['K'], inp['T'], inp['r'], inp['sigma']
    is_call = (inp['flag'] == 'c').astype(np.float32)
    log_m = np.log(K / S)
    sqrtT = np.sqrt(T)
    return np.stack([S, K, T, r, sigma, is_call, log_m, sqrtT, sigma * sqrtT], axis=1).astype(np.float32)


def make_bs_dataset(n: int = 200_000, seed: int = 42):
    rng = np.random.default_rng(seed)
    inp = sample_bs_inputs(n, rng)
    tgt = bs_targets(inp)
    X = features_matrix(inp)
    Y = np.stack([tgt['price'], tgt['delta'], tgt['gamma'], tgt['vega'], tgt['theta'], tgt['rho']], axis=1).astype(np.float32)
    return X, Y


def make_iv_dataset(n: int = 200_000, seed: int = 43):
    """Inputs: [price, S, K, T, r, is_call, log_m, sqrtT, price/S] → output: sigma.

    Filters out near-intrinsic options where IV is numerically ill-defined.
    """
    rng = np.random.default_rng(seed)
    # oversample to compensate for filtering
    inp = sample_bs_inputs(int(n * 1.3), rng)
    tgt = bs_targets(inp)
    S, K, T, r = inp['S'], inp['K'], inp['T'], inp['r']
    is_call = (inp['flag'] == 'c').astype(np.float32)
    intrinsic = np.where(is_call == 1, np.maximum(S - K, 0), np.maximum(K - S, 0))
    time_value = tgt['price'] - intrinsic
    # require meaningful time value AND meaningful T (avoid expiry edge)
    keep = (time_value > 0.05) & (T > 5 / 365) & (tgt['price'] > 0.05)
    log_m = np.log(K / S)
    sqrtT = np.sqrt(T)
    X = np.stack([
        tgt['price'], S, K, T, r, is_call,
        log_m, sqrtT, tgt['price'] / S,
    ], axis=1).astype(np.float32)[keep][:n]
    Y = inp['sigma'].astype(np.float32).reshape(-1, 1)[keep][:n]
    return X, Y


def heston_mc_price(S0, K, T, r, v0, kappa, theta, xi, rho, flag='c', n_paths=20_000, n_steps=100, rng=None):
    """Monte Carlo Heston pricer (Euler full-truncation)."""
    rng = rng or np.random.default_rng()
    dt = T / n_steps
    S = np.full(n_paths, S0)
    v = np.full(n_paths, v0)
    for _ in range(n_steps):
        z1 = rng.standard_normal(n_paths)
        z2 = rho * z1 + np.sqrt(1 - rho * rho) * rng.standard_normal(n_paths)
        v_pos = np.maximum(v, 0)
        S = S * np.exp((r - 0.5 * v_pos) * dt + np.sqrt(v_pos * dt) * z1)
        v = v + kappa * (theta - v_pos) * dt + xi * np.sqrt(v_pos * dt) * z2
    payoff = np.maximum(S - K, 0) if flag == 'c' else np.maximum(K - S, 0)
    return float(np.exp(-r * T) * payoff.mean())


def make_heston_dataset(n: int = 30_000, n_paths: int = 8_000, n_steps: int = 60, seed: int = 44):
    rng = np.random.default_rng(seed)
    rows = []
    targets = []
    for _ in range(n):
        S0 = 100.0
        K = S0 * rng.uniform(0.7, 1.3)
        T = rng.uniform(0.05, 1.5)
        r = rng.uniform(0.0, 0.06)
        v0 = rng.uniform(0.01, 0.2)
        kappa = rng.uniform(0.5, 4.0)
        theta = rng.uniform(0.01, 0.2)
        xi = rng.uniform(0.05, 0.8)
        rho_p = rng.uniform(-0.95, 0.0)
        flag = rng.choice(['c', 'p'])
        is_call = 1.0 if flag == 'c' else 0.0
        price = heston_mc_price(S0, K, T, r, v0, kappa, theta, xi, rho_p, flag, n_paths, n_steps, rng)
        rows.append([S0, K, T, r, v0, kappa, theta, xi, rho_p, is_call, np.log(K / S0), np.sqrt(T)])
        targets.append([price])
    return np.array(rows, dtype=np.float32), np.array(targets, dtype=np.float32)


def american_binomial(S, K, T, r, sigma, flag='c', n_steps=200):
    """Cox-Ross-Rubinstein binomial American option price."""
    dt = T / n_steps
    u = np.exp(sigma * np.sqrt(dt))
    d = 1 / u
    p = (np.exp(r * dt) - d) / (u - d)
    disc = np.exp(-r * dt)
    j = np.arange(n_steps + 1)
    ST = S * (u ** (n_steps - j)) * (d ** j)
    V = np.maximum(ST - K, 0) if flag == 'c' else np.maximum(K - ST, 0)
    for i in range(n_steps - 1, -1, -1):
        j = np.arange(i + 1)
        ST = S * (u ** (i - j)) * (d ** j)
        intrinsic = np.maximum(ST - K, 0) if flag == 'c' else np.maximum(K - ST, 0)
        V = disc * (p * V[:-1] + (1 - p) * V[1:])
        V = np.maximum(V, intrinsic)
    return float(V[0])


def make_american_dataset(n: int = 50_000, n_steps: int = 200, seed: int = 45):
    rng = np.random.default_rng(seed)
    rows = []
    targets = []
    for _ in range(n):
        S = 100.0
        K = S * rng.uniform(0.6, 1.4)
        T = rng.uniform(1 / 365, 2.0)
        r = rng.uniform(0.0, 0.08)
        sigma = rng.uniform(0.05, 0.7)
        flag = rng.choice(['c', 'p'])
        is_call = 1.0 if flag == 'c' else 0.0
        price = american_binomial(S, K, T, r, sigma, flag, n_steps)
        rows.append([S, K, T, r, sigma, is_call, np.log(K / S), np.sqrt(T), sigma * np.sqrt(T)])
        targets.append([price])
    return np.array(rows, dtype=np.float32), np.array(targets, dtype=np.float32)
