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

      <div style={{ display: "flex", border: "1px solid var(--hud-line)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
        {CAMPUS.map((c) => (
          <button
            key={c}
            onClick={() => setCampus(c)}
            style={{
              flex: 1, padding: "10px", border: 0, cursor: "pointer", fontWeight: 600,
              background: campus === c ? "var(--gold-grad)" : "transparent",
              color: campus === c ? "#1a1203" : "var(--muted)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {!datos && !error && <p className="muted">Cargando…</p>}

      {datos && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 6 }}>
            <Kpi titulo="Integrantes" valor={datos.total} />
            <Kpi titulo="Años en la iglesia (prom.)" valor={datos.anos.promIglesia} />
            <Kpi titulo="Años sirviendo (prom.)" valor={datos.anos.promServ} />
            <Kpi titulo="Visitas por contactar" valor={datos.visitas.pendientes} alerta={datos.visitas.pendientes > 0} />
            <Kpi titulo="Bajas por aprobar" valor={datos.solicitudes} alerta={datos.solicitudes > 0} />
          </div>

          <p className="muted" style={{ margin: "20px 0 8px" }}>Equipos de {campus}</p>
          {datos.areas.length === 0 && <p className="muted">Sin integrantes registrados en {campus}.</p>}
          {datos.areas.map((a) => (
            <div className="tarjeta" key={a.area} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>{a.area}</p>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                  {a.total} personas · {a.promIglesia} años en la iglesia · {a.promServ} sirviendo
                </p>
              </div>
              <button
                className="boton"
                style={{ padding: "8px 14px", fontSize: "0.85rem", width: "auto" }}
                onClick={() => router.push("/equipos")}
              >
                Ver
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, alerta }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="tarjeta" style={{ margin: 0 }}>
      <p className="muted" style={{ margin: 0, fontSize: "0.72rem", textTransform: "uppercase" }}>{titulo}</p>
      <p className="num" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "4px 0 0", color: alerta ? "var(--danger)" : "var(--accent)" }}>{valor}</p>
    </div>
  );
}
