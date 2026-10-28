"use client";

import { useEffect, useState, useCallback } from "react";
import { CAMPUS } from "@/lib/sesiones";

const ESTADOS = ["Pendiente", "Contactado", "Agendado", "Reunido", "Sin respuesta"] as const;

type Visita = {
  id: number;
  campus: string;
  nombre: string;
  telefono: string | null;
  nota: string | null;
  proximo: string | null;
  estado: string;
};

/** Módulo Visitas/Conexión — equivalente a api_ecoVisitas / api_ecoVisitaAdd /
 * api_ecoVisitaEstado, ya existentes. (Asignar a alguien del equipo de
 * Conexión queda para una vuelta siguiente — por ahora el foco es registrar
 * y mover el estado, que es lo que usa Conexión día a día.) */
export default function VisitasPage() {
  const [campus, setCampus] = useState<(typeof CAMPUS)[number]>(CAMPUS[0]);
  const [lista, setLista] = useState<Visita[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (c: string) => {
    const res = await fetch(`/api/visitas?campus=${encodeURIComponent(c)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar(campus);
  }, [campus, cargar]);

  async function crear(fd: FormData) {
    setGuardando(true);
    const res = await fetch("/api/visitas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        nombre: fd.get("nombre"),
        telefono: fd.get("telefono") || undefined,
        nota: fd.get("nota") || undefined,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    await cargar(campus);
  }

  async function cambiarEstado(id: number, estado: string) {
    const res = await fetch(`/api/visitas/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar(campus);
  }

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Visitas</h1>
      {error && <p className="aviso">{error}</p>}

      <div className="campo">
        <label>Campus</label>
        <select value={campus} onChange={(e) => setCampus(e.target.value as (typeof CAMPUS)[number])}>
          {CAMPUS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
        {mostrarForm ? "Cerrar" : "Registrar visita"}
      </button>

      {mostrarForm && (
        <form className="tarjeta" action={(fd) => crear(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="campo">
            <label>Nombre</label>
            <input name="nombre" required />
          </div>
          <div className="campo">
            <label>Teléfono</label>
            <input name="telefono" />
          </div>
          <div className="campo">
            <label>Nota</label>
            <textarea name="nota" rows={3} />
          </div>
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Registrar"}
          </button>
        </form>
      )}

      {lista?.length === 0 && <p className="muted">Sin visitas registradas en {campus}.</p>}
      {lista?.map((v) => (
        <div className="tarjeta" key={v.id}>
          <p style={{ fontWeight: 600, margin: 0 }}>{v.nombre}</p>
          <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.8rem" }}>
            {v.telefono || "Sin teléfono"}{v.nota ? ` · ${v.nota}` : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ESTADOS.map((e) => {
              const activo = v.estado === e;
              return (
                <button
                  key={e}
                  onClick={() => !activo && cambiarEstado(v.id, e)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: "0.75rem",
                    border: `1px solid ${activo ? "var(--accent)" : "var(--line)"}`,
                    background: activo ? "var(--accent)" : "transparent",
                    color: activo ? "var(--accent-ink)" : "var(--muted)",
                    cursor: activo ? "default" : "pointer",
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
