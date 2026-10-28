"use client";

import { useEffect, useState, useCallback } from "react";

type Proximo = { id: string; nombre: string; campus: string; area: string; en_dias: number };
type Propuesta = { id: number; nombres: string; fecha: string; mensaje: string | null; estado: string };

/** Módulo Cumpleaños: próximos cumpleaños + propuestas del vigilante
 * automático para aprobar/anular — equivalente a api_ecoCumples /
 * api_cumpleProps / api_cumpleAprobar / api_cumpleAnular, ya existentes. */
export default function CumpleanosPage() {
  const [proximos, setProximos] = useState<Proximo[] | null>(null);
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const [rp, rq] = await Promise.all([fetch("/api/cumpleanos"), fetch("/api/cumpleanos/propuestas")]);
    const [jp, jq] = await Promise.all([rp.json(), rq.json()]);
    if (!jp.ok) { setError(jp.error); return; }
    setProximos(jp.data);
    if (jq.ok) setPropuestas(jq.data.filter((p: Propuesta) => p.estado === "Pendiente"));
    setError(null);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function resolver(id: number, accion: "aprobar" | "anular") {
    setResolviendo(id);
    const res = await fetch(`/api/cumpleanos/propuestas/${id}/${accion}`, { method: "PATCH" });
    const json = await res.json();
    setResolviendo(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  if (!proximos && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Cumpleaños</h1>
      {error && <p className="aviso">{error}</p>}

      {propuestas && propuestas.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <p className="muted" style={{ marginBottom: 8 }}>Saludos pendientes de aprobar</p>
          {propuestas.map((p) => (
            <div className="tarjeta" key={p.id}>
              <p style={{ fontWeight: 600, margin: 0 }}>{p.nombres}</p>
              <p className="muted" style={{ margin: "2px 0 8px", fontSize: "0.8rem" }}>{p.fecha}</p>
              {p.mensaje && <p style={{ margin: "0 0 10px", fontSize: "0.88rem" }}>{p.mensaje}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="boton" style={{ flex: 1 }} disabled={resolviendo === p.id} onClick={() => resolver(p.id, "aprobar")}>
                  Aprobar y enviar
                </button>
                <button className="boton-peligro" style={{ flex: 1 }} disabled={resolviendo === p.id} onClick={() => resolver(p.id, "anular")}>
                  Anular
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="muted" style={{ marginBottom: 8 }}>Próximos 30 días</p>
      {proximos?.length === 0 && <p className="muted">Nadie cumple años en los próximos 30 días.</p>}
      {proximos?.map((i) => (
        <div className="fila" key={i.id}>
          <span>{i.nombre} <span className="muted">· {i.campus}</span></span>
          <span className="num">{i.en_dias === 0 ? "Hoy" : `en ${i.en_dias} días`}</span>
        </div>
      ))}
    </div>
  );
}
