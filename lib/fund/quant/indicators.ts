// SAHJONY FAMILY FUND · QUANT ENGINE — technical indicators.
//
// Pure, deterministic array math. Same series in → same indicator out. These
// are the building blocks the strategies and backtester compose. Every function
// returns an array aligned to the input length, with `NaN` in the warm-up
// window so the backtester never trades on an unformed indicator (no look-ahead,
// no silent zero-fill that would fake a signal).

export const NA = NaN;

export function sma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NA);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NA);
  const k = 2 / (period + 1);
  let prev = NA;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    if (Number.isNaN(prev)) {
      // seed with the SMA of the first `period` values
      let s = 0; for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

// Wilder's RSI (0..100).
export function rsi(values: number[], period = 14): number[] {
  const out = new Array(values.length).fill(NA);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(0, change), loss = Math.max(0, -change);
    if (i <= period) {
      avgGain += gain; avgLoss += loss;
      if (i === period) {
        avgGain /= period; avgLoss /= period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}

// Average True Range (Wilder) — for volatility sizing and breakout stops.
export function atr(high: number[], low: number[], close: number[], period = 14): number[] {
  const n = close.length;
  const out = new Array(n).fill(NA);
  const tr = new Array(n).fill(NA);
  for (let i = 0; i < n; i++) {
    if (i === 0) { tr[i] = high[i] - low[i]; continue; }
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
  }
  let prev = NA;
  for (let i = 0; i < n; i++) {
    if (i < period) { if (i === period - 1) { let s = 0; for (let j = 0; j < period; j++) s += tr[j]; prev = s / period; out[i] = prev; } continue; }
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

// Rolling standard deviation (sample) — Bollinger / z-score / realized vol.
export function rollingStd(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NA);
  for (let i = period - 1; i < values.length; i++) {
    const win = values.slice(i - period + 1, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / period;
    const variance = win.reduce((a, b) => a + (b - mean) ** 2, 0) / (period - 1);
    out[i] = Math.sqrt(variance);
  }
  return out;
}

// Rate of change over `period` bars, as a fraction (0.12 = +12%).
export function roc(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NA);
  for (let i = period; i < values.length; i++) {
    if (values[i - period] !== 0) out[i] = values[i] / values[i - period] - 1;
  }
  return out;
}

// Highest / lowest of the prior `period` bars (Donchian channel, excludes today).
export function priorHigh(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NA);
  for (let i = period; i < values.length; i++) out[i] = Math.max(...values.slice(i - period, i));
  return out;
}
export function priorLow(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NA);
  for (let i = period; i < values.length; i++) out[i] = Math.min(...values.slice(i - period, i));
  return out;
}

// Simple daily returns aligned to the price series (first element 0).
export function dailyReturns(close: number[]): number[] {
  const out = new Array(close.length).fill(0);
  for (let i = 1; i < close.length; i++) out[i] = close[i - 1] !== 0 ? close[i] / close[i - 1] - 1 : 0;
  return out;
}
