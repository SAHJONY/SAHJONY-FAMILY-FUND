"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { useI18n } from "@/components/i18n";
import type { BacktestResult } from "@/lib/fund/quant/backtest";
import type { SymbolSignals } from "@/lib/fund/quant/signals";
import type { SizingResult } from "@/lib/fund/quant/sizing";
import type { PaperValuation } from "@/lib/fund/quant/paper";

interface StrategyMeta { id: string; name: string; description: string; defaults: Record<string, number> }
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toFixed(2);
const col = (n: number) => (n > 0 ? "var(--good)" : n < 0 ? "var(--bad)" : "var(--muted)");

function EquityCurve({ r }: { r: BacktestResult }) {
  const pts = r.equityCurve;
  if (pts.length < 2) return null;
  const W = 520, H = 160, pad = 4;
  const all = pts.flatMap((p) => [p.strategy, p.benchmark]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const line = (key: "strategy" | "benchmark") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <path d={line("benchmark")} fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
      <path d={line("strategy")} fill="none" stroke="var(--hud)" strokeWidth="1.6" style={{ filter: "drop-shadow(0 0 3px var(--hud))" }} />
      <text x={pad} y={12} fontSize="9" fill="var(--hud)">strategy ×{r.strategy.finalEquity.toFixed(2)}</text>
      <text x={pad} y={24} fontSize="9" fill="var(--muted)">buy&amp;hold ×{r.benchmark.finalEquity.toFixed(2)}</text>
    </svg>
  );
}

function MetricRow({ label, s, b, fmt = num, better = "high" }: { label: string; s: number; b: number; fmt?: (n: number) => string; better?: "high" | "low" }) {
  const win = better === "high" ? s > b : s < b;
  return (
    <tr className="border-t border-[rgba(63,224,255,0.08)]">
      <td className="py-1 text-[var(--muted)] text-[10px] uppercase tracking-wide">{label}</td>
      <td className="text-right hud-text" style={{ color: win ? "var(--good)" : "var(--text)" }}>{fmt(s)}</td>
      <td className="text-right hud-text text-[var(--muted)]">{fmt(b)}</td>
    </tr>
  );
}

export default function StrategyLab() {
  const { t } = useI18n();
  const [strategies, setStrategies] = useState<StrategyMeta[]>([]);
  const [live, setLive] = useState<{ enabled: boolean; reason: string } | null>(null);
  const [paper, setPaper] = useState<PaperValuation | null>(null);

  const [symbol, setSymbol] = useState("SPY");
  const [strategyId, setStrategyId] = useState("ma_cross");
  const [years, setYears] = useState(5);
  const [bt, setBt] = useState<BacktestResult | null>(null);
  const [sig, setSig] = useState<SymbolSignals | null>(null);
  const [sizing, setSizing] = useState<SizingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // paper order form
  const [oSym, setOSym] = useState("SPY");
  const [oQty, setOQty] = useState(100);
  const [oSide, setOSide] = useState<"buy" | "sell">("buy");

  const loadMeta = useCallback(async () => {
    const r = await fetch("/api/fund/quant"); const j = await r.json();
    setStrategies(j.strategies || []); setLive(j.live); setPaper(j.paper);
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const post = (body: object) => fetch("/api/fund/quant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  const run = useCallback(async () => {
    setBusy(true); setErr(""); setBt(null); setSig(null); setSizing(null);
    try {
      const [a, c, d] = await Promise.all([
        post({ action: "backtest", symbol, strategyId, years }),
        post({ action: "signals", symbol }),
        post({ action: "size", symbol, strategyId, years, nav: 1_000_000 }),
      ]);
      if (a.error && c.error) { setErr(a.error || c.error); }
      if (a.result) setBt(a.result);
      if (c.signals) setSig(c.signals);
      if (d.sizing) setSizing(d.sizing);
      if (a.error && !a.result) setErr(a.error);
    } catch { setErr("network error"); }
    finally { setBusy(false); }
  }, [symbol, strategyId, years]);

  const placeOrder = useCallback(async () => {
    setErr("");
    const j = await post({ action: "paper_order", symbol: oSym, side: oSide, qty: oQty });
    if (j.error) setErr(j.error); else setPaper(j.paper);
  }, [oSym, oSide, oQty]);

  const resetPaper = useCallback(async () => {
    const j = await post({ action: "paper_reset", startingCash: 1_000_000 });
    if (j.paper) setPaper(j.paper);
  }, []);

  const selected = strategies.find((s) => s.id === strategyId);

  return (
    <div className="space-y-4">
      <div className="border border-[rgba(255,194,75,0.4)] bg-[rgba(255,194,75,0.05)] px-3 py-2">
        <div className="text-[var(--gold)] text-xs font-bold tracking-wider">{t("labTitle")}</div>
        <div className="text-[10px] text-[var(--muted)] mt-0.5">{t("labDisclaimer")}</div>
      </div>

      {/* Controls */}
      <Panel title={t("backtestSignals")}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[10px] text-[var(--muted)] uppercase tracking-wide">{t("symbol")}
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="block mt-1 w-28 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1 hud-text text-[var(--text)] text-sm" />
          </label>
          <label className="text-[10px] text-[var(--muted)] uppercase tracking-wide">{t("strategy")}
            <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}
              className="block mt-1 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1 hud-text text-[var(--text)] text-sm">
              {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-[var(--muted)] uppercase tracking-wide">{t("years")}
            <input type="number" min={1} max={10} value={years} onChange={(e) => setYears(Number(e.target.value))}
              className="block mt-1 w-16 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1 hud-text text-[var(--text)] text-sm" />
          </label>
          <button onClick={run} disabled={busy}
            className="text-[11px] tracking-[0.2em] uppercase px-4 py-2 font-bold border border-[var(--hud)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.08)] disabled:opacity-50">
            {busy ? t("running") : `▶ ${t("run")}`}
          </button>
        </div>
        {selected && <div className="text-[10px] text-[var(--muted)] mt-2">{selected.description}</div>}
        {err && <div className="text-[10px] text-[var(--bad)] mt-2">{err}</div>}
      </Panel>

      {bt && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title={`Backtest · ${bt.symbol} · ${bt.from} → ${bt.to}`}>
            <EquityCurve r={bt} />
            <table className="w-full text-[11px] mt-2">
              <thead><tr className="text-[9px] uppercase text-[var(--muted)]"><th /><th className="text-right">Strategy</th><th className="text-right">Buy&amp;Hold</th></tr></thead>
              <tbody>
                <MetricRow label="Total return" s={bt.strategy.totalReturn} b={bt.benchmark.totalReturn} fmt={pct} />
                <MetricRow label="CAGR" s={bt.strategy.cagr} b={bt.benchmark.cagr} fmt={pct} />
                <MetricRow label="Volatility" s={bt.strategy.volatility} b={bt.benchmark.volatility} fmt={pct} better="low" />
                <MetricRow label="Sharpe" s={bt.strategy.sharpe} b={bt.benchmark.sharpe} />
                <MetricRow label="Sortino" s={bt.strategy.sortino} b={bt.benchmark.sortino} />
                <MetricRow label="Max drawdown" s={bt.strategy.maxDrawdown} b={bt.benchmark.maxDrawdown} fmt={pct} better="high" />
                <MetricRow label="Calmar" s={bt.strategy.calmar} b={bt.benchmark.calmar} />
                <MetricRow label="Win rate" s={bt.strategy.winRate} b={bt.benchmark.winRate} fmt={(n) => `${(n * 100).toFixed(0)}%`} />
                <MetricRow label="Exposure" s={bt.strategy.exposure} b={bt.benchmark.exposure} fmt={(n) => `${(n * 100).toFixed(0)}%`} better="low" />
                <MetricRow label="Trades" s={bt.strategy.trades} b={bt.benchmark.trades} fmt={(n) => String(n)} better="low" />
              </tbody>
            </table>
            <div className="text-[10px] mt-2" style={{ color: col(bt.edge.sharpe) }}>
              Edge vs buy&amp;hold: {pct(bt.edge.cagr)} CAGR · {bt.edge.sharpe >= 0 ? "+" : ""}{num(bt.edge.sharpe)} Sharpe
            </div>
          </Panel>

          <div className="space-y-4">
            {sig && (
              <Panel title="Current Signals" badge={<span className="text-[9px] tracking-widest" style={{ color: sig.ensembleStance === "risk-on" ? "var(--good)" : sig.ensembleStance === "risk-off" ? "var(--bad)" : "var(--muted)" }}>{sig.ensembleStance.toUpperCase()}</span>}>
                <div className="text-[10px] text-[var(--muted)] mb-2">Ensemble {sig.ensemble >= 0 ? "+" : ""}{sig.ensemble} · {(sig.agreement * 100).toFixed(0)}% agreement · systematic readings, not instructions</div>
                <div className="space-y-1">
                  {sig.signals.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--muted)]">{s.name}</span>
                      <span className="hud-text flex items-center gap-1" style={{ color: s.stance === "long" ? "var(--good)" : s.stance === "short" ? "var(--bad)" : "var(--muted)" }}>
                        {s.stance.toUpperCase()}{s.changedToday && <span className="text-[8px] px-1 border border-[var(--gold)] text-[var(--gold)]">FLIP</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            {sizing && (
              <Panel title="Position Sizing">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><div className="text-[9px] uppercase text-[var(--muted)]">Realized vol</div><div className="hud-text">{(sizing.realizedVolAnnual * 100).toFixed(0)}%</div></div>
                  <div><div className="text-[9px] uppercase text-[var(--muted)]">Vol-target wt</div><div className="hud-text">{(sizing.volTargetWeight * 100).toFixed(0)}%</div></div>
                  <div><div className="text-[9px] uppercase text-[var(--muted)]">Full Kelly</div><div className="hud-text">{(sizing.kellyFraction * 100).toFixed(0)}%</div></div>
                  <div><div className="text-[9px] uppercase text-[var(--muted)]">Half Kelly</div><div className="hud-text">{(sizing.halfKelly * 100).toFixed(0)}%</div></div>
                  <div className="col-span-2 border-t border-[rgba(63,224,255,0.1)] pt-1"><div className="text-[9px] uppercase text-[var(--muted)]">Suggested weight (on $1M)</div><div className="hud-text text-[var(--gold)]">{(sizing.suggestedWeight * 100).toFixed(0)}% · ${sizing.dollarAtNav.toLocaleString()}</div></div>
                </div>
                <div className="text-[9px] text-[var(--muted)] mt-2">{sizing.note}</div>
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* Paper trading */}
      <Panel title={t("paperTrading")} badge={live && <span className="text-[9px] tracking-widest" style={{ color: live.enabled ? "var(--good)" : "var(--muted)" }}>{live.enabled ? "LIVE" : "PAPER ONLY"}</span>}>
        {paper && (
          <div className="grid md:grid-cols-5 gap-px bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.2)] mb-3">
            {[
              { l: "Equity", v: `$${paper.equity.toLocaleString()}` },
              { l: "Cash", v: `$${paper.cash.toLocaleString()}` },
              { l: "Positions", v: `$${paper.positionsValue.toLocaleString()}` },
              { l: "Realized P&L", v: `$${paper.realizedPnl.toLocaleString()}`, c: col(paper.realizedPnl) },
              { l: "Total return", v: `${paper.totalReturnPct >= 0 ? "+" : ""}${paper.totalReturnPct}%`, c: col(paper.totalReturnPct) },
            ].map((c) => (
              <div key={c.l} className="bg-[var(--bg,#06090f)] px-3 py-2"><div className="text-[9px] uppercase tracking-widest text-[var(--muted)]">{c.l}</div><div className="hud-text text-sm" style={{ color: c.c ?? "var(--text)" }}>{c.v}</div></div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <input value={oSym} onChange={(e) => setOSym(e.target.value.toUpperCase())} placeholder="SYM"
            className="w-20 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1 hud-text text-sm" />
          <select value={oSide} onChange={(e) => setOSide(e.target.value as "buy" | "sell")}
            className="bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1 hud-text text-sm">
            <option value="buy">BUY</option><option value="sell">SELL</option>
          </select>
          <input type="number" value={oQty} onChange={(e) => setOQty(Number(e.target.value))}
            className="w-24 bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.3)] px-2 py-1 hud-text text-sm" />
          <button onClick={placeOrder} className="text-[11px] tracking-[0.15em] uppercase px-4 py-1.5 font-bold border border-[var(--good)] text-[var(--good)] hover:bg-[rgba(80,255,160,0.08)]">Fill (paper)</button>
          <button onClick={resetPaper} className="text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border border-[rgba(255,255,255,0.2)] text-[var(--muted)] hover:text-[var(--text)]">Reset</button>
        </div>
        {paper && paper.positions.length > 0 && (
          <table className="w-full text-[11px] mt-3 hud-text">
            <thead><tr className="text-[9px] uppercase text-[var(--muted)] text-right"><th className="text-left">Symbol</th><th>Qty</th><th>Avg cost</th><th>Mark</th><th>Value</th><th>Unreal.</th></tr></thead>
            <tbody>
              {paper.positions.map((p) => (
                <tr key={p.symbol} className="text-right border-t border-[rgba(63,224,255,0.08)]">
                  <td className="text-left text-[var(--text)]">{p.symbol}</td><td>{p.qty}</td><td className="text-[var(--muted)]">{p.avgCost.toFixed(2)}</td><td>{p.mark.toFixed(2)}</td><td>${p.value.toLocaleString()}</td>
                  <td style={{ color: col(p.unrealized) }}>${p.unrealized.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {live && <div className="text-[9px] text-[var(--muted)] mt-3">{live.reason}</div>}
      </Panel>
    </div>
  );
}
