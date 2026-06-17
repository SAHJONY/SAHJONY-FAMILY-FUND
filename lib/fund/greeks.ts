// SAHJONY FAMILY FUND — Black-Scholes Greeks, computed locally. No external
// library. Same inputs in → same Greeks out (fully deterministic).
//
// Inputs are per-share. Theta is returned PER DAY (calendar) so the dashboard's
// "what the book bleeds per day" number is direct. Vega is per 1.00 of vol
// (i.e. a full 100 IV points); analytics scales it to per-1-IV-point.

import type { Greeks, OptionType } from "./types";

// Standard normal PDF and CDF (Abramowitz & Stegun 7.1.26 approximation).
function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function cdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-0.5 * x * x);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

// S spot, K strike, T years to expiry, r risk-free, sigma IV (decimal).
export function blackScholes(
  type: OptionType,
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): Greeks {
  if (S <= 0 || K <= 0 || sigma <= 0 || T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, iv: sigma };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const Nd1 = cdf(d1);
  const Nd2 = cdf(d2);
  const nd1 = pdf(d1);

  const gamma = nd1 / (S * sigma * sqrtT);
  const vega = S * nd1 * sqrtT;            // per 1.00 vol (per 100 IV pts)

  let delta: number, theta: number;
  if (type === "call") {
    delta = Nd1;
    theta =
      (-(S * nd1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * Nd2);
  } else {
    delta = Nd1 - 1;
    theta =
      (-(S * nd1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * cdf(-d2));
  }
  return {
    delta,
    gamma,
    theta: theta / 365, // annual → per calendar day
    vega,
    iv: sigma,
  };
}

// Years to expiry from an as-of date to a YYYY-MM-DD expiry (calendar days/365).
export function yearsToExpiry(expiry: string, asof: string): number {
  const ms = new Date(`${expiry}T00:00:00Z`).getTime() - new Date(`${asof}T00:00:00Z`).getTime();
  return Math.max(0, ms / (365 * 24 * 3600 * 1000));
}

export function daysToExpiry(expiry: string, asof: string): number {
  const ms = new Date(`${expiry}T00:00:00Z`).getTime() - new Date(`${asof}T00:00:00Z`).getTime();
  return Math.round(ms / (24 * 3600 * 1000));
}
