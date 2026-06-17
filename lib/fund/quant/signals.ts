// SAHJONY FAMILY FUND · QUANT ENGINE — current signals.
//
// For a symbol, computes where each strategy stands RIGHT NOW (long / flat /
// short) on the latest bar, plus an ensemble stance (the average across
// strategies). These are systematic, rule-based readings — the same rules,
// applied to today's data. They are signals, not instructions to trade.

import type { Bar } from "../market";
import { STRATEGIES, getStrategy, type Position } from "./strategies";

export interface StrategySignal {
  id: string;
  name: string;
  position: Position;          // latest position
  stance: "long" | "flat" | "short";
  changedToday: boolean;       // did the position flip on the most recent bar?
}

export interface SymbolSignals {
  symbol: string;
  asof: string;
  signals: StrategySignal[];
  ensemble: number;            // mean position across strategies, −1..+1
  ensembleStance: "risk-on" | "neutral" | "risk-off";
  agreement: number;           // share of strategies agreeing with the ensemble sign
}

const stanceOf = (p: Position): "long" | "flat" | "short" => (p > 0 ? "long" : p < 0 ? "short" : "flat");

export function signalsForSymbol(symbol: string, bars: Bar[], asof: string): SymbolSignals | null {
  if (bars.length < 30) return null;
  // Exclude the always-long benchmark from the ensemble vote.
  const active = STRATEGIES.filter((s) => s.id !== "buy_hold");
  const signals: StrategySignal[] = active.map((s) => {
    const pos = s.positions(bars, s.defaults);
    const last = pos[pos.length - 1] ?? 0;
    const prev = pos[pos.length - 2] ?? 0;
    return { id: s.id, name: s.name, position: last, stance: stanceOf(last), changedToday: last !== prev };
  });
  const ensemble = signals.reduce((a, s) => a + s.position, 0) / signals.length;
  const sign = Math.sign(ensemble);
  const agreement = sign === 0 ? 0 : signals.filter((s) => Math.sign(s.position) === sign).length / signals.length;
  return {
    symbol, asof, signals,
    ensemble: Math.round(ensemble * 100) / 100,
    ensembleStance: ensemble > 0.2 ? "risk-on" : ensemble < -0.2 ? "risk-off" : "neutral",
    agreement: Math.round(agreement * 100) / 100,
  };
}

export { getStrategy };
