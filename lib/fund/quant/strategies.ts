// SAHJONY FAMILY FUND · QUANT ENGINE — systematic strategy library.
//
// Each strategy maps a price/bar series to a POSITION series in {-1, 0, +1}
// (short / flat / long), decided from information available AT or BEFORE each
// bar. The backtester then applies position[i] to the return of bar i+1, so
// there is no look-ahead: a signal formed on today's close is only earned on
// tomorrow's move. These are well-known systematic rules — trend, momentum,
// mean-reversion, breakout, vol-managed — not secret sauce and not advice.

import type { Bar } from "../market";
import {
  sma, ema, rsi, atr, rollingStd, roc, priorHigh, priorLow, dailyReturns, NA,
} from "./indicators";

export type Position = -1 | 0 | 1;

export interface StrategyParams { [k: string]: number }

export interface Strategy {
  id: string;
  name: string;
  description: string;
  defaults: StrategyParams;
  // returns a position series aligned to bars.length
  positions: (bars: Bar[], p: StrategyParams) => Position[];
}

const closes = (bars: Bar[]) => bars.map((b) => b.close);

// 1) Trend — moving-average crossover. Long while fast > slow, else flat.
const maCross: Strategy = {
  id: "ma_cross",
  name: "MA Crossover (Trend)",
  description: "Long when the fast moving average is above the slow one; flat otherwise. The classic golden/death-cross trend filter.",
  defaults: { fast: 50, slow: 200, allowShort: 0 },
  positions: (bars, p) => {
    const c = closes(bars);
    const f = sma(c, p.fast), s = sma(c, p.slow);
    return c.map((_, i) => {
      if (Number.isNaN(f[i]) || Number.isNaN(s[i])) return 0;
      if (f[i] > s[i]) return 1;
      return p.allowShort ? -1 : 0;
    });
  },
};

// 2) Momentum — long when N-month return is positive (time-series momentum).
const momentum: Strategy = {
  id: "momentum",
  name: "Time-Series Momentum",
  description: "Long when trailing return over the lookback is positive; flat (or short) when negative. The cross-asset momentum effect.",
  defaults: { lookback: 126, allowShort: 0 },
  positions: (bars, p) => {
    const r = roc(closes(bars), p.lookback);
    return r.map((v) => (Number.isNaN(v) ? 0 : v > 0 ? 1 : p.allowShort ? -1 : 0));
  },
};

// 3) Mean reversion — RSI bands. Buy oversold, exit at the midline.
const rsiReversion: Strategy = {
  id: "rsi_reversion",
  name: "RSI Mean Reversion",
  description: "Enter long when RSI is oversold, exit when it reverts past the midline. Counter-trend; works best in range-bound regimes.",
  defaults: { period: 14, oversold: 30, exit: 50 },
  positions: (bars, p) => {
    const r = rsi(closes(bars), p.period);
    const pos: Position[] = [];
    let held = 0 as Position;
    for (let i = 0; i < r.length; i++) {
      if (Number.isNaN(r[i])) { pos.push(0); continue; }
      if (held === 0 && r[i] < p.oversold) held = 1;
      else if (held === 1 && r[i] >= p.exit) held = 0;
      pos.push(held);
    }
    return pos;
  },
};

// 4) Breakout — Donchian channel. Long on a new N-day high, exit on N-day low.
const donchian: Strategy = {
  id: "donchian",
  name: "Donchian Breakout",
  description: "Go long on a breakout above the prior N-day high, exit on a break below the prior M-day low. Trend-following à la the Turtles.",
  defaults: { entry: 55, exit: 20, allowShort: 0 },
  positions: (bars, p) => {
    const c = closes(bars);
    const hi = priorHigh(c, p.entry), lo = priorLow(c, p.exit);
    const pos: Position[] = [];
    let held = 0 as Position;
    for (let i = 0; i < c.length; i++) {
      if (!Number.isNaN(hi[i]) && c[i] > hi[i]) held = 1;
      else if (!Number.isNaN(lo[i]) && c[i] < lo[i]) held = p.allowShort ? -1 : 0;
      pos.push(held);
    }
    return pos;
  },
};

// 5) Vol-managed trend — MA trend gate, but flat when realized vol spikes above
//    its own median (de-risk in turbulent regimes). A risk-aware trend overlay.
const volManaged: Strategy = {
  id: "vol_managed",
  name: "Vol-Managed Trend",
  description: "Long with the trend (price > MA) but step aside when short-term realized volatility runs hot versus its own history. Targets smoother equity.",
  defaults: { ma: 100, volWindow: 20, volMult: 1.5 },
  positions: (bars, p) => {
    const c = closes(bars);
    const trend = sma(c, p.ma);
    const rets = dailyReturns(c);
    const vol = rollingStd(rets, p.volWindow);
    // median of formed vol values, as the calm/hot threshold reference
    const formed = vol.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    const median = formed.length ? formed[Math.floor(formed.length / 2)] : NA;
    return c.map((_, i) => {
      if (Number.isNaN(trend[i]) || Number.isNaN(vol[i]) || Number.isNaN(median)) return 0;
      const up = c[i] > trend[i];
      const calm = vol[i] <= median * p.volMult;
      return up && calm ? 1 : 0;
    });
  },
};

// 6) Buy & hold — the honest benchmark every strategy is measured against.
const buyHold: Strategy = {
  id: "buy_hold",
  name: "Buy & Hold (Benchmark)",
  description: "Always long. The benchmark — a strategy only earns its complexity if it beats this on risk-adjusted terms.",
  defaults: {},
  positions: (bars) => bars.map(() => 1),
};

export const STRATEGIES: Strategy[] = [
  maCross, momentum, rsiReversion, donchian, volManaged, buyHold,
];

export function getStrategy(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

// ATR-based per-share risk for position sizing (exposed for the sizing layer).
export function atrSeries(bars: Bar[], period = 14): number[] {
  return atr(bars.map((b) => b.high), bars.map((b) => b.low), bars.map((b) => b.close), period);
}

export { ema }; // re-export for convenience in signal blending
