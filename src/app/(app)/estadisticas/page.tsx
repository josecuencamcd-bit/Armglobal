"use client";

import { useEffect, useState, useCallback } from "react";
import { VolverAdministracion } from "@/lib/volver-admin";

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
      <VolverAdministracion />
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

      <div className="seg3" style={{ margin: "12px 0" }}>
        {[7, 15, 30].map((v) => (
          <button key={v} aria-pressed={v === datos.dias} onClick={() => cargar(v, area)}>
            {v} días
          </button>
        ))}
      </div>

      <div className="eco-cards" style={{ marginBottom: 16 }}>
        <div className="eco-card"><span>Veces que sirvieron</span><b>{datos.servicios}</b></div>
        <div className={`eco-card${datos.pct != null && datos.pct < 60 ? " warn" : " ok"}`}><span>Asistencia</span><b>{datos.pct == null ? "–" : `${datos.pct}%`}</b></div>
        <div className="eco-card"><span>Encuentros</span><b>{datos.encuentros}</b></div>
        <div className={`eco-card${datos.sinServir ? " warn" : ""}`}><span>Sin servir en el período</span><b>{datos.sinServir}</b></div>
      </div>

      <p className="muted" style={{ fontSize: "0.82rem" }}>Cuántas veces sirvió cada persona</p>
      {!datos.personas.length && <p className="muted">Aún no hay integrantes en este equipo.</p>}
      <section className="panel stack">
        {datos.personas.map((p) => (
          <div className="eco-row" key={p.nombre}>
            <div>
              <b>{p.nombre}</b>
              <small>Vino {p.vino} · Avisó {p.aviso} · No vino {p.noVino}{p.sinMarcar ? ` · Sin marcar ${p.sinMarcar}` : ""}</small>
              <div className="stat-bar"><i style={{ width: `${p.pct ?? 0}%` }} /></div>
            </div>
            <b>{p.pct == null ? "–" : `${p.pct}%`}</b>
          </div>
        ))}
      </section>
    </div>
  );
}
