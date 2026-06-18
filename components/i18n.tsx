"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "es";

// One dictionary for the whole app. t("key") returns the string for the current
// language. Missing keys fall back to the key itself (visible, easy to spot).
const DICT: Record<string, { en: string; es: string }> = {
  // chrome / nav
  controlPlane: { en: "‹ Control Plane", es: "‹ Centro de Control" },
  tagline: { en: "Deterministic multi-asset monitor · reports conditions, tracks your own targets · never recommends a trade", es: "Monitor multiactivo determinista · informa condiciones, sigue tus propios objetivos · nunca recomienda operar" },
  share: { en: "Share", es: "Compartir" },
  runPipeline: { en: "Run Pipeline", es: "Ejecutar Análisis" },
  running: { en: "Running…", es: "Ejecutando…" },
  logout: { en: "Sign out", es: "Cerrar sesión" },
  linkCopied: { en: "Link copied to clipboard.", es: "Enlace copiado al portapapeles." },
  runMsg: { en: "Pulling chains, valuing book, scoring macro, reading news…", es: "Cargando cadenas, valorando la cartera, midiendo el macro, leyendo noticias…" },
  runDone: { en: "Run complete", es: "Análisis completo" },
  // status strip
  nav: { en: "NAV", es: "Valor Neto" },
  unrealizedPnl: { en: "Unrealized P&L", es: "P&L No Realizado" },
  positions: { en: "Positions", es: "Posiciones" },
  alerts: { en: "Alerts", es: "Alertas" },
  macro: { en: "Macro", es: "Macro" },
  netDelta: { en: "Net Δ", es: "Delta Neto" },
  thetaDay: { en: "Theta/day", es: "Theta/día" },
  netVega: { en: "Net Vega", es: "Vega Neto" },
  asOf: { en: "As of", es: "Al" },
  // panels
  activeAlerts: { en: "Active Alerts", es: "Alertas Activas" },
  noAlerts: { en: "No active conditions. Every alert is a fact, never a buy/sell call.", es: "Sin condiciones activas. Cada alerta es un hecho, nunca una orden de compra/venta." },
  macroGate: { en: "Macro Gate", es: "Termómetro Macro" },
  deterministic: { en: "DETERMINISTIC", es: "DETERMINISTA" },
  macroNote: { en: "Same data in, same score out. Context, not a trade signal.", es: "Mismos datos, mismo puntaje. Contexto, no una señal para operar." },
  positionsPanel: { en: "Positions", es: "Posiciones" },
  allocation: { en: "Allocation & Concentration", es: "Asignación y Concentración" },
  byTicker: { en: "By Ticker", es: "Por Símbolo" },
  bySector: { en: "By Sector", es: "Por Sector" },
  byAssetClass: { en: "By Asset Class", es: "Por Clase de Activo" },
  newsRead: { en: "Claude News Read", es: "Lectura de Noticias (Claude)" },
  onePaid: { en: "THE ONE PAID PIECE", es: "LA ÚNICA PARTE PAGA" },
  noReport: { en: "No report yet", es: "Aún no hay informe" },
  noReportBody: { en: "The pipeline hasn't run. Click Run Pipeline to pull live data, value the book, score the macro environment, and read the news.", es: "El análisis no se ha ejecutado. Pulsa Ejecutar Análisis para cargar datos en vivo, valorar la cartera, medir el entorno macro y leer las noticias." },
  loading: { en: "Loading…", es: "Cargando…" },
  monitorFooter: { en: "This system stays a monitor: it reports conditions and tracks your targets. Nothing here recommends a trade or routes an order.", es: "Este sistema es un monitor: informa condiciones y sigue tus objetivos. Nada aquí recomienda operar ni envía órdenes." },
  // plan / upgrade
  planFree: { en: "FREE", es: "GRATIS" },
  planPro: { en: "PRO", es: "PRO" },
  upgrade: { en: "Upgrade to Pro", es: "Mejorar a Pro" },
  upgradeNote: { en: "Pro unlocks real-time data, Claude news, alerts, and full backtest history.", es: "Pro desbloquea datos en tiempo real, noticias de Claude, alertas e historial completo de backtests." },
  // brain
  brainTitle: { en: "Analyst Brain", es: "Cerebro Analista" },
  brainIntro: { en: "Ask about your book — positions, P&L, Greeks, the macro gate, a backtest, the news. It explains; it never tells you to trade.", es: "Pregunta sobre tu cartera — posiciones, P&L, griegas, el termómetro macro, un backtest, las noticias. Explica; nunca te dice que operes." },
  brainPlaceholder: { en: "e.g. Explain my net delta and theta…", es: "ej. Explica mi delta neto y theta…" },
  ask: { en: "Ask", es: "Preguntar" },
  thinking: { en: "Thinking…", es: "Pensando…" },
  // lab
  labTitle: { en: "Strategy Lab · Quant Engine", es: "Laboratorio de Estrategias · Motor Cuantitativo" },
  labDisclaimer: { en: "Backtested on real history with no look-ahead. Metrics are measured, not promised — past performance does not predict future results, and this is software for your own decisions, not financial advice. Execution is paper-only.", es: "Probado sobre historia real sin anticipación de datos. Las métricas son medidas, no prometidas — el rendimiento pasado no predice resultados futuros, y esto es software para tus propias decisiones, no asesoría financiera. La ejecución es solo en papel." },
  backtestSignals: { en: "Backtest & Signals", es: "Backtest y Señales" },
  symbol: { en: "Symbol", es: "Símbolo" },
  strategy: { en: "Strategy", es: "Estrategia" },
  years: { en: "Years", es: "Años" },
  run: { en: "Run", es: "Ejecutar" },
  paperTrading: { en: "Paper Trading", es: "Operación en Papel" },
  // vault
  myKeys: { en: "My API Keys", es: "Mis Claves API" },
  vaultNote: { en: "Your own provider keys — used only for your account. Leave blank to use the app defaults.", es: "Tus propias claves de proveedor — usadas solo en tu cuenta. Déjalas en blanco para usar las predeterminadas." },
  saveKey: { en: "Save", es: "Guardar" },
  set: { en: "set", es: "configurada" },
  // login
  signIn: { en: "Sign in", es: "Iniciar sesión" },
  register: { en: "Create account", es: "Crear cuenta" },
  email: { en: "Email", es: "Correo" },
  name: { en: "Name", es: "Nombre" },
  password: { en: "Password", es: "Contraseña" },
  loginCta: { en: "Each family member gets their own private, secured account.", es: "Cada miembro de la familia tiene su propia cuenta privada y segura." },
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function useI18n() { return useContext(LangCtx); }

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("sahjony-lang")) as Lang | null;
    if (saved === "en" || saved === "es") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("sahjony-lang", l); } catch {} };
  const t = (k: string) => DICT[k]?.[lang] ?? k;
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex border border-[rgba(63,224,255,0.3)]">
      {(["en", "es"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className="text-[10px] px-2 py-1 uppercase tracking-widest"
          style={{ background: lang === l ? "var(--hud)" : "transparent", color: lang === l ? "#000" : "var(--muted)" }}>
          {l}
        </button>
      ))}
    </div>
  );
}
