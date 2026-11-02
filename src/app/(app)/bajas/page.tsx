"use client";

import { useEffect, useState, useCallback } from "react";
import { VolverAdministracion } from "@/lib/volver-admin";

type Baja = { id: number; nombre: string | null; campus: string; area: string; motivo: string; estado: string; solicitante: string | null; fecha: string };

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Bajas: solicitudes de dar de baja a un integrante, pendientes de
 * aprobación — mismo nav top-level que la app vieja ("Bajas"), contra
 * /api/integrantes/solicitudes-baja(/[id]), ya existentes. */
export default function BajasPage() {
  const [lista, setLista] = useState<Baja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/integrantes/solicitudes-baja");
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function resolver(id: number, aprobar: boolean) {
    setOcupado(id);
    const res = await fetch(`/api/integrantes/solicitudes-baja/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobar }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Bajas</h1>
      {error && <p className="aviso">{error}</p>}
      {!lista && !error && <p className="muted">Cargando…</p>}

      {lista && (
        <section className="tarjeta stack">
          <span className="label">Solicitudes de baja</span>
          {!lista.length && <p className="muted">No hay solicitudes.</p>}
          {lista.map((b) => (
            <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="eco-row">
                <div>
                  <b>{b.nombre ?? `Integrante #${b.id}`}</b>
                  <small>{b.area} · {b.campus} · pidió {b.solicitante ?? "—"} el {fechaCorta(b.fecha)}</small>
                  <small>Motivo: {b.motivo}</small>
                </div>
                <span className={`eco-badge ${b.estado === "Aprobada" ? "ok" : b.estado === "Rechazada" ? "bad" : "warn"}`}>
                  {b.estado}
                </span>
              </div>
              {b.estado === "Pendiente" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="boton-secundario"
                    style={{ flex: 1 }}
                    disabled={ocupado === b.id}
                    onClick={() => resolver(b.id, false)}
                  >
                    Rechazar
                  </button>
                  <button className="boton" style={{ flex: 1 }} disabled={ocupado === b.id} onClick={() => resolver(b.id, true)}>
                    {ocupado === b.id ? "…" : "Aprobar baja"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
