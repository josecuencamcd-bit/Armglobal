"use client";

/** graficoLinea: mini gráfico de línea SVG para la tendencia de ingresos de
 * los últimos n meses (porte 1:1 del gráfico de Inicio en la app vieja —
 * ahí no existía una librería de charts, era un SVG a mano). */
const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function GraficoLinea({ datos }: { datos: { mes: string; monto: number }[] }) {
  if (!datos.length) return null;
  const w = 280;
  const h = 64;
  const pad = 6;
  const max = Math.max(1, ...datos.map((d) => d.monto));
  const paso = datos.length > 1 ? (w - pad * 2) / (datos.length - 1) : 0;
  const puntos = datos.map((d, i) => {
    const x = pad + i * paso;
    const y = h - pad - (d.monto / max) * (h - pad * 2);
    return { x, y, d };
  });
  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${linea} L${puntos[puntos.length - 1].x.toFixed(1)},${h - pad} L${puntos[0].x.toFixed(1)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="gl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#gl-fill)" />
      <path d={linea} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === puntos.length - 1 ? 3 : 2} fill="var(--accent-2)" />
      ))}
      {puntos.map((p, i) => (
        <text key={i} x={p.x} y={h + 11} fontSize="8" textAnchor="middle" fill="var(--muted)">
          {MESES_CORTO[Number(p.d.mes.slice(5, 7)) - 1]}
        </text>
      ))}
    </svg>
  );
}

export function peso(n: number): string {
  return "$" + Math.round(n || 0).toLocaleString("es-CL");
}
