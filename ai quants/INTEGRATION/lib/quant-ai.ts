/**
 * Client wrapper for the ai-quants FastAPI service.
 *
 * Service runs at NEXT_PUBLIC_QUANT_API (default http://localhost:8000).
 * Start it with: cd "ai quants" && uvicorn serve:app --port 8000
 */

const API = process.env.NEXT_PUBLIC_QUANT_API ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

// ----- pricing endpoints (analytical-grade accuracy) -----

export type Flag = "c" | "p";

export interface BSResult {
  price: number; delta: number; gamma: number;
  vega: number; theta: number; rho: number;
}

/** Black-Scholes price + 5 Greeks via neural surrogate (≈0.1% rel err vs analytical). */
export const priceBS = (p: { S: number; K: number; T: number; r: number; sigma: number; flag: Flag })
  => post<BSResult>("/api/bs", p);

/** Implied volatility from observed option price (≈0.9% rel err). */
export const solveIV = (p: { price: number; S: number; K: number; T: number; r: number; flag: Flag })
  => post<{ sigma: number }>("/api/iv", p);

/** American option pricer (≈0.5% rel err vs CRR binomial). */
export const priceAmerican = (p: { S: number; K: number; T: number; r: number; sigma: number; flag: Flag })
  => post<{ price: number }>("/api/american", p);

/** Heston stochastic-vol pricer. */
export const priceHeston = (p: {
  S: number; K: number; T: number; r: number;
  v0: number; kappa: number; theta: number; xi: number; rho: number; flag: Flag;
}) => post<{ price: number }>("/api/heston", p);

// ----- direction endpoints (statistical predictions, NOT financial advice) -----

export interface ConsensusResult {
  ticker: string;
  models: {
    binary?: { p_up: number; prediction: "up" | "down"; conviction_band: string };
    magnitude?: { expected_return: number; magnitude_band: string };
    sequence?: { expected_return: number; direction: "up" | "down" };
    transformer?: { expected_return: number; direction: "up" | "down" };
    quantile?: { p10: number; p50: number; p90: number; decision: "long" | "short" | "flat" };
  };
  consensus: {
    n_models: number;
    agree_count: number;
    direction: "up" | "down" | "split";
    avg_magnitude: number;
    tier: "ultra" | "high" | "medium" | "low";
    expected_accuracy_band: string;
  };
}

/**
 * Multi-model directional prediction with agreement-tier confidence.
 * Use this in the UI — never expose raw probabilities to retail users.
 */
export const consensus = (ticker: string, period = "2y")
  => post<ConsensusResult>("/api/consensus", { ticker, period });

/** Quantile forecast — natural confidence intervals. */
export const quantile = (ticker: string, period = "2y")
  => post<{ p10: number; p50: number; p90: number; uncertainty_width: number; decision: string }>("/api/quantile", { ticker, period });

// ----- health check -----
export const health = () => fetch(`${API}/health`).then(r => r.json());
