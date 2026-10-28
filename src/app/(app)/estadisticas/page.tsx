"use client";

import { useEffect, useState, useCallback } from "react";

type Persona = { nombre: string; vino: number; aviso: number; noVino: number; sinMarcar: number; pct: number | null };
type Datos = {
  campus: string;
  area: string;
  areas: string[];
  dias: number;
  desde: string;
  hasta: string;
  encuentros: number;
  integrantes: number;
  servicios: number;
  faltaron: number;
  pct: number | null;
  sinServir: number;
  personas: Persona[];
};

function fechaCorta(f: string) {
  const [, m, d] = f.split("-");
  return `${d}/${m}`;
}

/** Módulo Estadísticas (= vEquipoStats/api_ecoEquipoStats de Code.gs):
 * cuántas veces sirvió cada integrante del equipo, últimos 7/15/30 días. */
export default function EstadisticasPage() {
  const [dias, setDias] = useState(30);
  const [area, setArea] = useState<string | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (d: number, a: string | null) => {
    const qs = new URLSearchParams({ dias: String(d) });
    if (a) qs.set("area", a);
    const res = await fetch(`/api/integrantes/stats?${qs.toString()}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setDatos(json.data);
    setDias(json.data.dias);
    setArea(json.data.area);
    setError(null);
  }, []);

  useEffect(() => {
    cargar(dias, area);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!datos && !error) return <div className="contenedor">Cargando…</div>;
  if (error) return <div className="contenedor"><p className="aviso">{error}</p></div>;
  if (!datos) return null;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Estadísticas</h1>
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: -6 }}>
        Del {fechaCorta(datos.desde)} al {fechaCorta(datos.hasta)} · equipo {datos.area} ({datos.integrantes} personas). Solo ves a tu equipo.
      </p>

      {datos.areas.length > 1 && (
        <div className="campo">
          <label>Equipo</label>
          <select value={datos.area} onChange={(e) => cargar(dias, e.target.value)}>
            {datos.areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        {[7, 15, 30].map((v) => (
          <button
            key={v}
            className={v === datos.dias ? "boton" : "boton-secundario"}
            onClick={() => cargar(v, area)}
            style={{ flex: 1 }}
          >
            {v} días
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="tarjeta"><div className="muted" style={{ fontSize: "0.78rem" }}>Veces que sirvieron</div><div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{datos.servicios}</div></div>
        <div className="tarjeta"><div className="muted" style={{ fontSize: "0.78rem" }}>Asistencia</div><div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{datos.pct == null ? "—" : `${datos.pct}%`}</div></div>
        <div className="tarjeta"><div className="muted" style={{ fontSize: "0.78rem" }}>Encuentros</div><div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{datos.encuentros}</div></div>
        <div className="tarjeta"><div className="muted" style={{ fontSize: "0.78rem" }}>Sin servir en el período</div><div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{datos.sinServir}</div></div>
      </div>

      <p className="muted" style={{ fontSize: "0.82rem" }}>Cuántas veces sirvió cada persona</p>
      {!datos.personas.length && <p className="muted">Aún no hay integrantes en este equipo.</p>}
      {datos.personas.map((p) => (
        <div className="fila" key={p.nombre} style={{ alignItems: "stretch" }}>
          <div style={{ flex: 1 }}>
            <div>{p.nombre}</div>
            <div className="muted" style={{ fontSize: "0.76rem" }}>
              Vino {p.vino} · Avisó {p.aviso} · No vino {p.noVino}{p.sinMarcar ? ` · Sin marcar ${p.sinMarcar}` : ""}
            </div>
            <div style={{ background: "var(--line)", borderRadius: 6, height: 6, marginTop: 4, overflow: "hidden" }}>
              <div style={{ width: `${p.pct ?? 0}%`, background: "var(--accent)", height: "100%" }} />
            </div>
          </div>
          <b style={{ marginLeft: 10 }}>{p.pct == null ? "—" : `${p.pct}%`}</b>
        </div>
      ))}
    </div>
  );
}
