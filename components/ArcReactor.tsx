"use client";

// The SAHJONY core — an arc-reactor style emblem with counter-rotating rings.
// `active` brightens the core (used to react to voice/processing state).
export default function ArcReactor({
  size = 72,
  active = false,
}: {
  size?: number;
  active?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={active ? "gold-glow" : ""}
      style={{ borderRadius: "50%" }}
    >
      <defs>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#bff4ff" />
          <stop offset="100%" stopColor="#1ea7c7" />
        </radialGradient>
      </defs>

      {/* outer dashed ring */}
      <circle
        cx="50" cy="50" r="46" fill="none"
        stroke="var(--hud)" strokeOpacity="0.5" strokeWidth="1.5"
        strokeDasharray="3 5" className="spin-slow"
      />
      {/* mid ticked ring */}
      <g className="spin-med">
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--hud-dim)" strokeWidth="2" />
        {Array.from({ length: 18 }).map((_, i) => {
          const a = (i / 18) * Math.PI * 2;
          const x1 = 50 + Math.cos(a) * 34;
          const y1 = 50 + Math.sin(a) * 34;
          const x2 = 50 + Math.cos(a) * 40;
          const y2 = 50 + Math.sin(a) * 40;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--hud)" strokeOpacity={i % 3 === 0 ? 0.9 : 0.4} strokeWidth="1.5" />
          );
        })}
      </g>
      {/* inner coil ring (the reactor windings) */}
      <g className={active ? "spin-fast" : "spin-med"}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x = 50 + Math.cos(a) * 22;
          const y = 50 + Math.sin(a) * 22;
          return (
            <rect key={i} x={x - 2.5} y={y - 5} width="5" height="10" rx="1"
              fill="var(--hud)" fillOpacity="0.85"
              transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />
          );
        })}
      </g>
      {/* triangle frame */}
      <polygon points="50,30 67,60 33,60" fill="none"
        stroke={active ? "var(--gold)" : "var(--hud)"} strokeWidth="1.5" strokeOpacity="0.8" />
      {/* glowing core */}
      <circle cx="50" cy="50" r="13" fill="url(#core)" className="core-pulse" />
      <circle cx="50" cy="50" r="13" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
    </svg>
  );
}
