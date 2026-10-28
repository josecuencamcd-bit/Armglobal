"use client";

import { useEffect, useState, useCallback } from "react";
import { CAMPUS } from "@/lib/sesiones";

type Turno = { semana: string; campus: string; nombres: string[] | null; correos: string[] | null };

/** Lunes ISO de la semana que contiene `fecha` (mismo criterio que
 * lunesDe_ en Code.gs). */
function lunesDe(fecha: Date): string {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
}

/** Módulo Turnos: calendario de quién administra cada campus semana a
 * semana — equivalente a api_turnoLista/api_turnoGuardar, ya existentes. */
export default function TurnosPage() {
  const [campus, setCampus] = useState<(typeof CAMPUS)[number]>(CAMPUS[0]);
  const [lista, setLista] = useState<Turno[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [semana, setSemana] = useState(lunesDe(new Date()));
  const [nombres, setNombres] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (c: string) => {
    const res = await fetch(`/api/turnos?campus=${encodeURIComponent(c)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar(campus);
  }, [campus, cargar]);

  async function guardar() {
    setGuardando(true);
    const res = await fetch("/api/turnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        semana,
        campus,
        nombres: nombres.split(",").map((n) => n.trim()).filter(Boolean),
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setNombres("");
    await cargar(campus);
  }

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Turnos</h1>
      {error && <p className="aviso">{error}</p>}

      <div className="campo">
        <label>Campus</label>
        <select value={campus} onChange={(e) => setCampus(e.target.value as (typeof CAMPUS)[number])}>
          {CAMPUS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontWeight: 600, margin: 0 }}>Asignar semana</p>
        <div className="campo">
          <label>Semana (lunes)</label>
          <input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} />
        </div>
        <div className="campo">
          <label>Quién administra (separar por coma)</label>
          <input value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Nombre 1, Nombre 2" />
        </div>
        <button className="boton" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>

      <p className="muted" style={{ margin: "16px 0 8px" }}>Semanas asignadas</p>
      {lista?.length === 0 && <p className="muted">Sin semanas asignadas en {campus}.</p>}
      {lista?.map((t) => (
        <div className="fila" key={t.semana}>
          <span>{t.semana}</span>
          <span>{(t.nombres ?? []).join(", ") || "—"}</span>
        </div>
      ))}
    </div>
  );
}
