"use client";

import { useEffect, useState, useCallback } from "react";
import { useCampus } from "@/lib/campus-context";
import { VolverAdministracion } from "@/lib/volver-admin";

type Semana = { semana: string; hasta: string; correos: string[]; nombres: string[] };
type Persona = { correo: string; nombre: string };
type Datos = { mes: string; campus: string; campusTodos: string[]; personas: Persona[]; semanas: Semana[] };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function mesTitulo(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}
function mesMover(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function fechaCorta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Módulo Administración semanal: calendario mensual de quién administra
 * cada campus, semana a semana — puerto 1:1 de vTurnos() del client.js
 * viejo. Antes era una sola semana suelta con un input de texto libre
 * separado por comas; ahora navega mes a mes (como la vieja) y elige
 * personas reales del directorio con chips, no texto escrito a mano. */
export default function AdministracionSemanalPage() {
  const { campusActivo, puedeElegir, elegirCampus } = useCampus();
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/administracion-semanal?mes=${mes}&campus=${encodeURIComponent(campusActivo)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setDatos(json.data);
    const sel: Record<string, string[]> = {};
    for (const s of json.data.semanas as Semana[]) sel[s.semana] = s.correos;
    setSeleccion(sel);
    setError(null);
  }, [mes, campusActivo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function toggle(semana: string, correo: string) {
    setSeleccion((s) => {
      const actuales = s[semana] ?? [];
      const nuevos = actuales.includes(correo) ? actuales.filter((c) => c !== correo) : [...actuales, correo];
      return { ...s, [semana]: nuevos };
    });
  }

  async function guardar(semana: string) {
    setGuardando(semana);
    const res = await fetch("/api/administracion-semanal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semana, campus: campusActivo, correos: seleccion[semana] ?? [] }),
    });
    const json = await res.json();
    setGuardando(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  if (!datos && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Administración semanal</h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campusActivo}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>
      <p className="muted" style={{ margin: "2px 0 16px", fontSize: "0.82rem" }}>
        Quién administra el campus cada semana — decide a quién le llega la alerta de encuentro pendiente.
      </p>
      {error && <p className="aviso">{error}</p>}

      <div className="eco-row" style={{ justifyContent: "center", gap: 14, margin: "4px 0 16px" }}>
        <button type="button" className="boton-secundario" style={{ width: "auto", minHeight: 36, padding: "0 14px" }} onClick={() => setMes((m) => mesMover(m, -1))}>‹</button>
        <b style={{ textTransform: "capitalize" }}>{mesTitulo(mes)}</b>
        <button type="button" className="boton-secundario" style={{ width: "auto", minHeight: 36, padding: "0 14px" }} onClick={() => setMes((m) => mesMover(m, 1))}>›</button>
      </div>

      <div className="stack">
        {datos?.semanas.map((s) => (
          <section className="tarjeta stack" style={{ margin: 0 }} key={s.semana}>
            <b>Semana del {fechaCorta(s.semana)} al {fechaCorta(s.hasta)}</b>
            {s.nombres.length > 0 && (
              <small className="eco-sub">Hoy: {s.nombres.join(" y ")}</small>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {datos.personas.map((p) => {
                const activo = (seleccion[s.semana] ?? []).includes(p.correo);
                return (
                  <button
                    key={p.correo}
                    type="button"
                    className="chip"
                    aria-pressed={activo}
                    onClick={() => toggle(s.semana, p.correo)}
                  >
                    {p.nombre}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="boton-secundario"
              style={{ width: "auto", minHeight: 36, padding: "0 14px", alignSelf: "flex-start" }}
              disabled={guardando === s.semana}
              onClick={() => guardar(s.semana)}
            >
              {guardando === s.semana ? "Guardando…" : "Guardar"}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
