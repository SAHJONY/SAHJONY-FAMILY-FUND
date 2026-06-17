"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, Gauge } from "@/components/ui";
import { useI18n } from "@/components/i18n";
import type {
  FundReport, ValuedPosition, Alert, AllocationSlice, NewsAnalysis,
} from "@/lib/fund/types";

const money = (n: number, d = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: d });
const sign = (n: number) => (n >= 0 ? "+" : "");
const pnlColor = (n: number) => (n > 0 ? "var(--good)" : n < 0 ? "var(--bad)" : "var(--muted)");

const SEV: Record<Alert["severity"], string> = {
  high: "var(--bad)", warn: "var(--gold)", info: "var(--hud)",
};

function StatusStrip({ r }: { r: FundReport }) {
  const { t } = useI18n();
  const a = r.analytics;
  const totalPnl = r.positions.reduce((s, p) => s + p.pnl, 0);
  const cells: { label: string; value: string; color?: string }[] = [
    { label: t("nav"), value: money(a.nav) },
    { label: t("unrealizedPnl"), value: `${sign(totalPnl)}${money(totalPnl)}`, color: pnlColor(totalPnl) },
    { label: t("positions"), value: String(r.positions.length) },
    { label: t("alerts"), value: String(r.alerts.length), color: r.alerts.some((x) => x.severity === "high") ? "var(--bad)" : undefined },
    { label: t("macro"), value: r.macro.available ? `${r.macro.score}/100` : "N/A", color: r.macro.score >= 60 ? "var(--good)" : r.macro.score >= 40 ? "var(--gold)" : "var(--bad)" },
    { label: t("netDelta"), value: a.netDelta.toLocaleString() },
    { label: t("thetaDay"), value: money(a.dailyTheta), color: pnlColor(a.dailyTheta) },
    { label: t("netVega"), value: money(a.netVega) },
    { label: t("asOf"), value: r.asof },
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-9 gap-px bg-[var(--hud-deep)] border border-[rgba(63,224,255,0.25)]">
      {cells.map((c) => (
        <div key={c.label} className="bg-[var(--bg,#06090f)] px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[var(--muted)]">{c.label}</div>
          <div className="hud-text text-sm" style={{ color: c.color ?? "var(--text)" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const { t } = useI18n();
  return (
    <Panel title={t("activeAlerts")} badge={<span className="label">{alerts.length}</span>}>
      {alerts.length === 0 ? (
        <div className="text-[var(--muted)] text-xs">{t("noAlerts")}</div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-auto">
          {alerts.map((a, i) => {
            const accent = a.kind === "new_strikes" || a.kind === "new_expiry" ? "var(--gold)" : SEV[a.severity];
            return (
              <div key={i} className="flex items-start gap-2 px-2 py-1.5 border-l-2"
                style={{ borderColor: accent, background: "rgba(255,255,255,0.02)" }}>
                <span className="hud-text text-[9px] px-1 mt-0.5 border tracking-widest" style={{ color: accent, borderColor: accent }}>
                  {a.kind.replace("_", " ").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--text)]">{a.message}</div>
                  {a.driver && <div className="text-[10px] text-[var(--muted)]">{a.driver}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function ProgressBar({ pct, accent }: { pct: number | null; accent: string }) {
  if (pct == null) return <span className="text-[var(--muted)] text-[10px]">—</span>;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-14 bg-[var(--hud-deep)]">
        <div className="h-full" style={{ width: `${clamped}%`, background: accent, boxShadow: `0 0 6px ${accent}` }} />
      </div>
      <span className="text-[9px] text-[var(--muted)]">{pct}%</span>
    </div>
  );
}

function PositionsGrid({ rows }: { rows: ValuedPosition[] }) {
  const { t } = useI18n();
  return (
    <Panel title={t("positionsPanel")} scan>
      <div className="overflow-auto max-h-[28rem]">
        <table className="w-full text-[11px] hud-text border-collapse">
          <thead>
            <tr className="text-[var(--muted)] text-[9px] uppercase tracking-wider text-right">
              <th className="text-left py-1 pr-2">Instrument</th>
              <th className="pr-2">DTE</th>
              <th className="pr-2">Entry</th>
              <th className="pr-2">Mark</th>
              <th className="pr-2">Value</th>
              <th className="pr-2">P&L $</th>
              <th className="pr-2">P&L %</th>
              <th className="pr-2">Δ</th>
              <th className="pr-2">Θ/day</th>
              <th className="pr-2">Vega</th>
              <th className="pr-2">IV</th>
              <th className="text-left pl-2">Target / Stop</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const o = p.pos;
              const instrument = o.asset_type === "option"
                ? `${o.ticker} ${o.strike}${(o.option_type ?? "c")[0].toUpperCase()} ${o.expiry}`
                : o.ticker !== "—" ? `${o.ticker} ${o.asset_type === "shares" ? "" : o.asset_type}` : o.label ?? "—";
              return (
                <tr key={o.id} className="text-right border-t border-[rgba(63,224,255,0.08)]">
                  <td className="text-left py-1 pr-2 text-[var(--text)] whitespace-nowrap">
                    {instrument}
                    <span className="ml-1 text-[8px] px-1 border" style={{
                      color: p.markSource === "live" ? "var(--good)" : p.markSource === "manual" ? "var(--gold)" : "var(--muted)",
                      borderColor: p.markSource === "live" ? "var(--good)" : p.markSource === "manual" ? "var(--gold)" : "var(--muted)",
                    }}>{p.markSource === "live" ? "LIVE" : p.markSource === "manual" ? "MAN" : "N/A"}</span>
                  </td>
                  <td className="pr-2">{p.dte != null ? (
                    <span className="px-1 border text-[9px]" style={{ color: p.dte <= 45 ? "var(--gold)" : "var(--muted)", borderColor: p.dte <= 45 ? "var(--gold)" : "rgba(255,255,255,0.15)" }}>{p.dte}d</span>
                  ) : "—"}</td>
                  <td className="pr-2 text-[var(--muted)]">{o.entry_price}</td>
                  <td className="pr-2">{p.mark ? p.mark.toFixed(2) : "—"}</td>
                  <td className="pr-2 text-[var(--text)]">{money(p.value)}</td>
                  <td className="pr-2" style={{ color: pnlColor(p.pnl) }}>{sign(p.pnl)}{money(p.pnl)}</td>
                  <td className="pr-2" style={{ color: pnlColor(p.pnl) }}>{sign(p.pnlPct)}{p.pnlPct}%</td>
                  <td className="pr-2 text-[var(--muted)]">{p.greeks ? p.greeks.delta.toFixed(2) : "—"}</td>
                  <td className="pr-2 text-[var(--muted)]">{p.greeks ? money(p.greeks.theta * o.contracts * p.multiplier) : "—"}</td>
                  <td className="pr-2 text-[var(--muted)]">{p.greeks ? (p.greeks.vega / 100 * o.contracts * p.multiplier).toFixed(0) : "—"}</td>
                  <td className="pr-2 text-[var(--muted)]">{p.greeks ? `${(p.greeks.iv * 100).toFixed(0)}%` : "—"}</td>
                  <td className="text-left pl-2">
                    <ProgressBar pct={p.progressToTarget} accent="var(--good)" />
                    <ProgressBar pct={p.progressToStop} accent="var(--bad)" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AllocBars({ title, slices }: { title: string; slices: AllocationSlice[] }) {
  return (
    <div>
      <div className="label mb-1.5">{title}</div>
      <div className="space-y-1">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="text-[10px] w-24 truncate text-[var(--muted)]">{s.key}</span>
            <div className="flex-1 h-3 bg-[var(--hud-deep)]">
              <div className="h-full flex items-center justify-end pr-1"
                style={{ width: `${Math.max(3, Math.min(100, s.pct))}%`, background: s.overCap ? "var(--bad)" : "var(--hud)", boxShadow: `0 0 6px ${s.overCap ? "var(--bad)" : "var(--hud)"}` }}>
                <span className="text-[8px] text-black font-bold">{s.pct}%</span>
              </div>
            </div>
            {s.overCap && <span className="text-[8px] text-[var(--bad)]">CAP</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroPanel({ r }: { r: FundReport }) {
  const { t } = useI18n();
  return (
    <Panel title={t("macroGate")} badge={<span className="text-[9px] text-[var(--muted)] tracking-widest">{t("deterministic")}</span>}>
      <div className="flex gap-4 items-center">
        <Gauge value={r.macro.score} label="ENVIRONMENT" unit="/100"
          accent={r.macro.score >= 60 ? "var(--good)" : r.macro.score >= 40 ? "var(--gold)" : "var(--bad)"} />
        <div className="flex-1 space-y-1.5">
          {r.macro.components.map((c) => (
            <div key={c.name}>
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--muted)]">{c.name} <span className="opacity-50">·{(c.weight * 100).toFixed(0)}%</span></span>
                <span className="hud-text" style={{ color: c.raw == null ? "var(--muted)" : "var(--text)" }}>{c.raw == null ? "N/A" : Math.round(c.score)}</span>
              </div>
              <div className="h-1 bg-[var(--hud-deep)]"><div className="h-full bg-[var(--hud)]" style={{ width: `${c.score}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[9px] text-[var(--muted)] mt-2">{t("macroNote")}</div>
    </Panel>
  );
}

const SENT_COLOR: Record<NewsAnalysis["sentiment"], string> = {
  positive: "var(--good)", neutral: "var(--muted)", negative: "var(--bad)",
};

function NewsPanel({ news }: { news: NewsAnalysis[] }) {
  const { t } = useI18n();
  return (
    <Panel title={t("newsRead")} badge={<span className="text-[9px] text-[var(--gold)] tracking-widest">{t("onePaid")}</span>}>
      {news.length === 0 ? (
        <div className="text-[var(--muted)] text-xs">No news pulled this run.</div>
      ) : (
        <div className="space-y-3 max-h-[28rem] overflow-auto">
          {news.map((n) => (
            <div key={n.ticker} className="border-l-2 pl-2" style={{ borderColor: SENT_COLOR[n.sentiment] }}>
              <div className="flex items-center gap-2">
                <span className="hud-text text-sm text-[var(--text)]">{n.ticker}</span>
                <span className="text-[9px] px-1 border tracking-widest" style={{ color: SENT_COLOR[n.sentiment], borderColor: SENT_COLOR[n.sentiment] }}>{n.sentiment.toUpperCase()}</span>
                <span className="text-[8px] text-[var(--muted)]">{n.model}{n.cached ? " · cached" : ""}</span>
              </div>
              <div className="text-[11px] text-[var(--text)] mt-0.5">{n.summary}</div>
              {n.drivers.length > 0 && (
                <ul className="text-[10px] text-[var(--muted)] mt-1 list-disc list-inside">
                  {n.drivers.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
              {n.positionFlag && (
                <div className="text-[10px] mt-1 px-1.5 py-0.5 inline-block" style={{ color: "var(--gold)", background: "rgba(255,194,75,0.08)" }}>⚑ {n.positionFlag}</div>
              )}
              {n.headlines.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {n.headlines.slice(0, 3).map((h, i) => (
                    <a key={i} href={h.link} target="_blank" rel="noreferrer" className="block text-[9px] text-[var(--hud)] hover:underline truncate">↗ {h.title} <span className="text-[var(--muted)]">— {h.publisher}</span></a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function FundDashboard() {
  const { t } = useI18n();
  const [report, setReport] = useState<FundReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/fund/state", { cache: "no-store" });
      const j = await r.json();
      setReport(j.report);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = useCallback(async () => {
    setRunning(true); setMsg(t("runMsg"));
    try {
      const r = await fetch("/api/fund/run", { method: "POST", body: JSON.stringify({}) });
      const j = await r.json();
      if (j.report) { setReport(j.report); setMsg(`${t("runDone")} · ${j.report.alerts.length} · ${j.report.errors.length} feed issue(s)`); }
      else setMsg(j.error || "—");
    } catch { setMsg("network error"); }
    finally { setRunning(false); }
  }, [t]);

  const share = useCallback(async () => {
    const data = { title: "SAHJONY CAPITAL LLC", text: "SAHJONY CAPITAL LLC — markets monitor & quant lab", url: window.location.href };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.url);
      setMsg(t("linkCopied"));
    } catch { /* user cancelled */ }
  }, [t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="hud-text text-xl text-[var(--gold)] tracking-wider">SAHJONY CAPITAL LLC</h1>
          <p className="text-[11px] text-[var(--muted)]">
            <a href="https://www.sahjonycapital.com" target="_blank" rel="noreferrer" className="text-[var(--hud)] hover:underline">www.sahjonycapital.com</a>
            <span className="mx-1.5">·</span>{t("tagline")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={share}
            className="text-[11px] tracking-[0.2em] uppercase px-4 py-2.5 border border-[rgba(63,224,255,0.4)] text-[var(--hud)] hover:bg-[rgba(63,224,255,0.08)]">
            ⤴ {t("share")}
          </button>
          <button onClick={run} disabled={running}
            className="text-[11px] tracking-[0.2em] uppercase px-5 py-2.5 font-bold border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,194,75,0.08)] disabled:opacity-50">
            {running ? t("running") : `▶ ${t("runPipeline")}`}
          </button>
        </div>
      </div>
      {msg && <div className="text-[10px] text-[var(--muted)]">{msg}</div>}

      {loading ? (
        <div className="text-[var(--muted)] text-sm">{t("loading")}</div>
      ) : !report ? (
        <Panel title={t("noReport")}>
          <div className="text-sm text-[var(--muted)]">{t("noReportBody")}</div>
        </Panel>
      ) : (
        <>
          <StatusStrip r={report} />
          <div className="grid lg:grid-cols-2 gap-4">
            <AlertsPanel alerts={report.alerts} />
            <MacroPanel r={report} />
          </div>
          <PositionsGrid rows={report.positions} />
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title={t("allocation")}>
              <div className="space-y-3">
                <AllocBars title={t("byTicker")} slices={report.analytics.byTicker} />
                <AllocBars title={t("bySector")} slices={report.analytics.bySector} />
                <AllocBars title={t("byAssetClass")} slices={report.analytics.byAssetClass} />
              </div>
            </Panel>
            <NewsPanel news={report.news} />
          </div>
          {report.errors.length > 0 && (
            <Panel title="Feed Notes">
              <ul className="text-[10px] text-[var(--muted)] list-disc list-inside">
                {report.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </Panel>
          )}
          <div className="text-[9px] text-[var(--muted)] text-center pt-2">
            {new Date(report.generatedAt).toLocaleString()} · {t("monitorFooter")}
          </div>
        </>
      )}
    </div>
  );
}
