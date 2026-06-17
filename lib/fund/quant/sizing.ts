// SAHJONY FAMILY FUND · QUANT ENGINE — position sizing.
//
// Tools, not advice. Given a strategy's own backtested edge and an asset's
// realized volatility, these compute how large a position the math implies under
// a stated risk budget. The owner decides whether to act. Sizing never turns a
// losing edge into a winning one — fractional Kelly on a negative edge returns 0.

import type { Bar } from "../market";
import type { Metrics } from "./backtest";
import { dailyReturns, rollingStd } from "./indicators";

const TRADING_DAYS = 252;

export interface SizingResult {
  realizedVolAnnual: number;       // the asset's annualized vol
  volTargetWeight: number;         // weight to hit the target portfolio vol (0..1+, capped)
  kellyFraction: number;           // full-Kelly fraction implied by backtest win/loss
  halfKelly: number;               // the prudent half-Kelly most desks actually use
  suggestedWeight: number;         // min(volTarget, halfKelly) — the conservative blend
  dollarAtNav: number;             // suggestedWeight × nav
  note: string;
}

// Annualized realized vol from the most recent `window` daily returns.
function realizedVol(bars: Bar[], window = 20): number {
  const rets = dailyReturns(bars.map((b) => b.close));
  const std = rollingStd(rets, window);
  const last = std[std.length - 1];
  return Number.isNaN(last) ? 0 : last * Math.sqrt(TRADING_DAYS);
}

// Kelly from per-trade odds: f* = W − (1−W)/R, where R = avg win / avg loss.
// We approximate W and R from the backtest's daily win rate and Sharpe-implied
// payoff so the number is grounded in *this* strategy's measured behaviour.
function kellyFromMetrics(m: Metrics): number {
  const W = m.winRate;
  if (W <= 0 || W >= 1) return 0;
  // payoff ratio proxy: a higher Sharpe implies a better win/loss size ratio.
  const R = Math.max(0.2, 1 + m.sharpe * 0.5);
  const f = W - (1 - W) / R;
  return Math.max(0, Math.min(1, f));
}

export function sizePosition(
  bars: Bar[], stratMetrics: Metrics, nav: number, targetVolAnnual = 0.15, maxWeight = 1
): SizingResult {
  const rv = realizedVol(bars);
  const volTargetWeight = rv > 0 ? Math.min(maxWeight, targetVolAnnual / rv) : 0;
  const kelly = kellyFromMetrics(stratMetrics);
  const half = kelly / 2;
  const suggested = Math.max(0, Math.min(volTargetWeight, half));
  return {
    realizedVolAnnual: Math.round(rv * 1000) / 1000,
    volTargetWeight: Math.round(volTargetWeight * 1000) / 1000,
    kellyFraction: Math.round(kelly * 1000) / 1000,
    halfKelly: Math.round(half * 1000) / 1000,
    suggestedWeight: Math.round(suggested * 1000) / 1000,
    dollarAtNav: Math.round(suggested * nav),
    note: stratMetrics.cagr <= stratMetrics.maxDrawdown * -0 && kelly === 0
      ? "No positive edge measured — sizing returns zero. Size only what the math earns."
      : `Conservative blend: min(vol-target ${(volTargetWeight * 100).toFixed(0)}%, half-Kelly ${(half * 100).toFixed(0)}%).`,
  };
}
