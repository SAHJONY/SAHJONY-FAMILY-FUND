// SAHJONY FAMILY FUND · QUANT ENGINE — backtester.
//
// Applies a strategy's position series to forward returns (position[i] earns the
// return of bar i+1 — strictly no look-ahead), nets out a configurable per-trade
// cost, and reports honest performance: CAGR, annualized vol, Sharpe, Sortino,
// max drawdown, Calmar, win rate, exposure, trade count — always alongside the
// buy-&-hold benchmark on the same window. "Profitability" here is MEASURED on
// real history, never promised. Past performance does not predict the future.

import type { Bar } from "../market";
import { dailyReturns } from "./indicators";
import { getStrategy, type Position } from "./strategies";

const TRADING_DAYS = 252;

export interface BacktestConfig {
  costBps: number;        // round-turn cost per position change, in basis points (default 5)
  riskFreeRate: number;   // annual, for Sharpe (default 0.045)
}

export interface Metrics {
  totalReturn: number;    // fraction over the window
  cagr: number;
  volatility: number;     // annualized
  sharpe: number;
  sortino: number;
  maxDrawdown: number;    // negative fraction
  calmar: number;
  winRate: number;        // share of in-market days that were positive
  exposure: number;       // fraction of days holding a position
  trades: number;         // number of position changes
  finalEquity: number;    // growth of $1
}

export interface BacktestResult {
  strategyId: string;
  symbol: string;
  from: string;
  to: string;
  bars: number;
  strategy: Metrics;
  benchmark: Metrics;     // buy & hold over the same window
  edge: { cagr: number; sharpe: number; maxDrawdown: number }; // strategy − benchmark
  equityCurve: { date: string; strategy: number; benchmark: number }[];
}

function annualize(meanDaily: number): number {
  return (1 + meanDaily) ** TRADING_DAYS - 1;
}

function computeMetrics(
  bars: Bar[], positions: Position[], costBps: number, rf: number
): { m: Metrics; equity: number[] } {
  const rets = dailyReturns(bars.map((b) => b.close));
  const cost = costBps / 10000;

  const stratRets: number[] = new Array(bars.length).fill(0);
  let prevPos = 0, trades = 0, inMarket = 0, winDays = 0;
  for (let i = 0; i < bars.length - 1; i++) {
    const pos = positions[i];
    if (pos !== prevPos) { trades++; stratRets[i + 1] -= cost * Math.abs(pos - prevPos); prevPos = pos; }
    const r = pos * rets[i + 1];
    stratRets[i + 1] += r;
    if (pos !== 0) { inMarket++; if (r > 0) winDays++; }
  }

  // equity curve (growth of $1)
  const equity: number[] = [1];
  for (let i = 1; i < bars.length; i++) equity.push(equity[i - 1] * (1 + stratRets[i]));

  const active = stratRets.slice(1);
  const mean = active.reduce((a, b) => a + b, 0) / active.length;
  const variance = active.reduce((a, b) => a + (b - mean) ** 2, 0) / active.length;
  const std = Math.sqrt(variance);
  const downside = Math.sqrt(active.filter((r) => r < 0).reduce((a, b) => a + b * b, 0) / active.length);

  const years = bars.length / TRADING_DAYS;
  const totalReturn = equity[equity.length - 1] - 1;
  const cagr = years > 0 ? equity[equity.length - 1] ** (1 / years) - 1 : 0;
  const volatility = std * Math.sqrt(TRADING_DAYS);
  const rfDaily = rf / TRADING_DAYS;
  const sharpe = std > 0 ? ((mean - rfDaily) / std) * Math.sqrt(TRADING_DAYS) : 0;
  const sortino = downside > 0 ? ((mean - rfDaily) / downside) * Math.sqrt(TRADING_DAYS) : 0;

  let peak = equity[0], maxDd = 0;
  for (const e of equity) { if (e > peak) peak = e; const dd = e / peak - 1; if (dd < maxDd) maxDd = dd; }
  const calmar = maxDd < 0 ? cagr / Math.abs(maxDd) : 0;

  const m: Metrics = {
    totalReturn, cagr, volatility, sharpe, sortino,
    maxDrawdown: maxDd, calmar,
    winRate: inMarket > 0 ? winDays / inMarket : 0,
    exposure: bars.length > 1 ? inMarket / (bars.length - 1) : 0,
    trades, finalEquity: equity[equity.length - 1],
  };
  return { m, equity };
}

export function backtest(
  strategyId: string, symbol: string, bars: Bar[], params: Record<string, number>, cfg: BacktestConfig
): BacktestResult | null {
  const strat = getStrategy(strategyId);
  if (!strat || bars.length < 30) return null;
  const p = { ...strat.defaults, ...params };

  const positions = strat.positions(bars, p);
  const { m: stratM, equity: stratEq } = computeMetrics(bars, positions, cfg.costBps, cfg.riskFreeRate);
  const { m: benchM, equity: benchEq } = computeMetrics(bars, bars.map(() => 1) as Position[], cfg.costBps, cfg.riskFreeRate);

  // downsample the curve for transport (~120 points)
  const step = Math.max(1, Math.floor(bars.length / 120));
  const equityCurve: BacktestResult["equityCurve"] = [];
  for (let i = 0; i < bars.length; i += step)
    equityCurve.push({ date: bars[i].date, strategy: Math.round(stratEq[i] * 1000) / 1000, benchmark: Math.round(benchEq[i] * 1000) / 1000 });

  return {
    strategyId, symbol, from: bars[0].date, to: bars[bars.length - 1].date, bars: bars.length,
    strategy: stratM, benchmark: benchM,
    edge: { cagr: stratM.cagr - benchM.cagr, sharpe: stratM.sharpe - benchM.sharpe, maxDrawdown: stratM.maxDrawdown - benchM.maxDrawdown },
    equityCurve,
  };
}

export const DEFAULT_BT_CONFIG: BacktestConfig = { costBps: 5, riskFreeRate: 0.045 };
