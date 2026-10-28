"use client";

import { useEffect, useState, useCallback } from "react";

type Baja = { id: number; nombre: string | null; campus: string; area: string; motivo: string; estado: string };

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

  const pendientes = lista?.filter((b) => b.estado === "Pendiente") ?? [];
  const resueltas = lista?.filter((b) => b.estado !== "Pendiente") ?? [];

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Bajas</h1>
      {error && <p className="aviso">{error}</p>}
      {!lista && !error && <p className="muted">Cargando…</p>}

      {lista && pendientes.length === 0 && <p className="muted">Sin bajas pendientes.</p>}
      {pendientes.map((b) => (
        <div className="tarjeta" key={b.id}>
          <p style={{ fontWeight: 600, margin: 0 }}>{b.nombre ?? `Integrante #${b.id}`}</p>
          <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.8rem" }}>{b.campus} · {b.area} · {b.motivo}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="boton" style={{ flex: 1 }} disabled={ocupado === b.id} onClick={() => resolver(b.id, true)}>
              {ocupado === b.id ? "…" : "Aprobar"}
            </button>
            <button
              style={{ flex: 1, background: "none", border: "1px solid var(--line)", borderRadius: 10, color: "var(--muted)" }}
              disabled={ocupado === b.id}
              onClick={() => resolver(b.id, false)}
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}

      {resueltas.length > 0 && (
        <>
          <p className="muted" style={{ margin: "20px 0 8px" }}>Resueltas</p>
          {resueltas.slice(0, 15).map((b) => (
            <div className="fila" key={b.id}>
              <span>{b.nombre ?? `Integrante #${b.id}`}</span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>{b.estado}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
