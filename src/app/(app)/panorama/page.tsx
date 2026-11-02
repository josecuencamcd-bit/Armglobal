"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CAMPUS } from "@/lib/sesiones";

type Area = { area: string; total: number; promIglesia: number; promServ: number };
type Panorama = {
  campus: string;
  total: number;
  anos: { promIglesia: number; promServ: number };
  areas: Area[];
  visitas: { pendientes: number };
  solicitudes: number;
};

/** Panorama: vista general del campus para Pastor/Admin app — misma
 * pantalla que "Panorama" en la app vieja (campus toggle + KPIs +
 * equipos), contra /api/integrantes/panorama, ya existente. */
export default function PanoramaPage() {
  const router = useRouter();
  const [campus, setCampus] = useState<(typeof CAMPUS)[number]>(CAMPUS[0]);
  const [datos, setDatos] = useState<Panorama | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (c: string) => {
    const res = await fetch(`/api/integrantes/panorama?campus=${encodeURIComponent(c)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setDatos(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar(campus);
  }, [campus, cargar]);

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Panorama</h1>
      {error && <p className="aviso">{error}</p>}

      <div className="seg" style={{ marginBottom: 16 }}>
        {CAMPUS.map((c) => (
          <button key={c} aria-pressed={campus === c} onClick={() => setCampus(c)}>
            {c}
          </button>
        ))}
      </div>

      {!datos && !error && <p className="muted">Cargando…</p>}

      {datos && (
        <>
          <div className="eco-cards" style={{ marginBottom: 16 }}>
            <div className="eco-card"><b>{datos.total}</b><span>Integrantes</span></div>
            <div className="eco-card"><b>{datos.anos.promIglesia}</b><span>Años en la iglesia (prom.)</span></div>
            <div className="eco-card"><b>{datos.anos.promServ}</b><span>Años sirviendo (prom.)</span></div>
            <div className={`eco-card${datos.visitas.pendientes ? " warn" : ""}`}><b>{datos.visitas.pendientes}</b><span>Visitas por contactar</span></div>
            <div className={`eco-card${datos.solicitudes ? " warn" : ""}`}><b>{datos.solicitudes}</b><span>Bajas por aprobar</span></div>
          </div>

          <section className="tarjeta stack">
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>EQUIPOS DE {campus.toUpperCase()}</p>
            {datos.areas.length === 0 && <p className="muted">Aún no hay integrantes registrados.</p>}
            {datos.areas.map((a) => (
              <div className="eco-row" key={a.area}>
                <div>
                  <b>{a.area}</b>
                  <small>{a.total} personas · {a.promIglesia} años en la iglesia · {a.promServ} sirviendo</small>
                </div>
                <button
                  className="boton-secundario"
                  style={{ width: "auto", padding: "6px 12px", fontSize: "0.8rem", flexShrink: 0 }}
                  onClick={() => router.push("/equipos")}
                >
                  Ver
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
