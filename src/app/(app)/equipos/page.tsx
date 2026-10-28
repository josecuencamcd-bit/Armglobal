"use client";

import { useEffect, useState, useCallback } from "react";
import { AREAS } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";

type Integrante = {
  id: number;
  campus: string;
  area: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  estado: string;
};

/** Módulo Equipos (= "Mi equipo"/integrantes) — equivalente a api_ecoEquipo*
 * de la app vieja, contra /api/integrantes(/[id]), ya existentes. */
export default function EquiposPage() {
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const [area, setArea] = useState<(typeof AREAS)[number]>(AREAS[0]);
  const [lista, setLista] = useState<Integrante[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (c: string, a: string) => {
    const res = await fetch(`/api/integrantes?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar(campus, area);
  }, [campus, area, cargar]);

  async function crear(fd: FormData) {
    setGuardando(true);
    const res = await fetch("/api/integrantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        area,
        nombre: fd.get("nombre"),
        telefono: fd.get("telefono") || undefined,
        correo: fd.get("correo") || undefined,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    await cargar(campus, area);
  }

  async function darDeBaja(id: number) {
    if (!confirm("¿Marcar como inactivo?")) return;
    const res = await fetch(`/api/integrantes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar(campus, area);
  }

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Equipos</h1>
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

      <div className="campo">
        <label>Área</label>
        <select value={area} onChange={(e) => setArea(e.target.value as (typeof AREAS)[number])}>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
        {mostrarForm ? "Cerrar" : "Agregar integrante"}
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
            <label>Correo</label>
            <input name="correo" type="email" />
          </div>
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}

      {lista?.filter((i) => i.estado === "Activo").length === 0 && (
        <p className="muted">Sin integrantes activos en {area} · {campus}.</p>
      )}
      {lista?.filter((i) => i.estado === "Activo").map((i) => (
        <div className="fila" key={i.id}>
          <div>
            <div>{i.nombre}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>{i.telefono || i.correo || ""}</div>
          </div>
          <button className="boton-peligro" onClick={() => darDeBaja(i.id)}>
            Dar de baja
          </button>
        </div>
      ))}
    </div>
  );
}
