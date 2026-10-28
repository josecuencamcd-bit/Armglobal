"use client";

import { useEffect, useState, useCallback } from "react";
import { useCampus } from "@/lib/campus-context";

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
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const [lista, setLista] = useState<Visita[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");

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

  const kpis = [
    { label: "Total", n: lista?.length ?? 0 },
    ...ESTADOS.map((e) => ({ label: e, n: lista?.filter((v) => v.estado === e).length ?? 0 })),
  ];

  const filtradas = (lista ?? []).filter((v) => {
    if (filtroEstado && v.estado !== filtroEstado) return false;
    if (busqueda && !v.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Visitas</h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campus}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>
      {error && <p className="aviso">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "14px 0" }}>
        {kpis.map((k) => (
          <div key={k.label} className="tarjeta" style={{ margin: 0, padding: "10px 12px", textAlign: "center" }}>
            <p className="num" style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>{k.n}</p>
            <p className="muted" style={{ margin: 0, fontSize: "0.68rem" }}>{k.label.toUpperCase()}</p>
          </div>
        ))}
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

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          placeholder="Buscar por nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", padding: "10px 12px" }}
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", padding: "10px 12px" }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {lista?.length === 0 && <p className="muted">Sin visitas registradas en {campus}.</p>}
      {lista && lista.length > 0 && filtradas.length === 0 && <p className="muted">Nada coincide con la búsqueda.</p>}
      {filtradas.map((v) => (
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
