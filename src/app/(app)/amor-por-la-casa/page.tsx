"use client";

import { useEffect, useState, useCallback } from "react";
import { useCampus } from "@/lib/campus-context";
import { VolverAdministracion } from "@/lib/volver-admin";
import { METODOS } from "@/lib/sesiones";

type Entrada = { id: string; nombre: string | null; monto: number; metodo: string; fecha: string };
type Datos = { campus: string; anio: string; entradas: Entrada[]; total: number };

const peso = (n: number) => `$${n.toLocaleString("es-CL")}`;
function fechaCL(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Amor por la Casa: aporte anual (una vez al año), separado a propósito de
 * los Aportes de un encuentro — su propio registro y su propio total, sin
 * mezclarse con el informe mensual de ofrenda/diezmo/siembra. Mismo patrón
 * de navegación que Administración semanal (por mes) pero por año.
 */
export default function AmorPorLaCasaPage() {
  const { campusActivo, puedeElegir, elegirCampus } = useCampus();
  const [anio, setAnio] = useState(() => new Date().getFullYear().toString());
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/amor-por-la-casa?anio=${anio}&campus=${encodeURIComponent(campusActivo)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setDatos(json.data);
    setError(null);
  }, [anio, campusActivo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarComo(metodo: string) {
    const m = Number(monto);
    if (!m || m <= 0) { setError("Escribe un monto mayor a cero."); return; }
    setGuardando(metodo);
    const res = await fetch("/api/amor-por-la-casa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre || "Sin nombre", monto: m, metodo, fecha, campus: campusActivo }),
    });
    const json = await res.json();
    setGuardando(null);
    if (!json.ok) { setError(json.error); return; }
    setNombre("");
    setMonto("");
    await cargar();
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar este registro de Amor por la Casa?")) return;
    const res = await fetch(`/api/amor-por-la-casa?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  if (!datos && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Amor por la Casa</h1>
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
        Aporte anual, aparte del informe mensual de encuentros.
      </p>
      {error && <p className="aviso">{error}</p>}

      <div className="eco-row" style={{ justifyContent: "center", gap: 14, margin: "4px 0 16px" }}>
        <button type="button" className="boton-secundario" style={{ width: "auto", minHeight: 36, padding: "0 14px" }} onClick={() => setAnio((a) => String(Number(a) - 1))}>‹</button>
        <b>{anio}</b>
        <button type="button" className="boton-secundario" style={{ width: "auto", minHeight: 36, padding: "0 14px" }} onClick={() => setAnio((a) => String(Number(a) + 1))}>›</button>
      </div>

      <div className="tarjeta hero-card">
        <div className="hero-tit">
          <span className="hero-ic"><b style={{ fontSize: "1rem" }}>$</b></span>
          <div>
            <b>TOTAL {anio}</b>
            <small>{datos?.entradas.length ?? 0} registro{(datos?.entradas.length ?? 0) === 1 ? "" : "s"} · {campusActivo}</small>
          </div>
        </div>
        <p className="hero-num">{peso(datos?.total ?? 0)}</p>
      </div>

      <div className="tarjeta">
        <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>NUEVO REGISTRO</p>
        <div className="campo">
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de quien aporta" />
        </div>
        <div className="campo">
          <label>Monto</label>
          <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" placeholder="10000" />
        </div>
        <div className="campo" style={{ marginBottom: 0 }}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="campo" style={{ marginBottom: 0, marginTop: 12 }}>
          <label>Guardar como pago en</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {METODOS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={!!guardando}
                onClick={() => guardarComo(m)}
                className="boton"
                style={{ padding: "10px 4px", fontSize: "0.78rem", lineHeight: 1.25 }}
              >
                {guardando === m ? "…" : (<>Guardar<br />{m}</>)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="muted" style={{ margin: "16px 0 8px" }}>Registros de {anio}</p>
      {(datos?.entradas.length ?? 0) === 0 && <p className="muted">Aún no hay registros en {anio}.</p>}
      {datos?.entradas.map((a) => (
        <div className="fila" key={a.id}>
          <div>
            <div>{a.nombre || "Sin nombre"}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>{fechaCL(a.fecha)} · {a.metodo}</div>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="num">{peso(a.monto)}</span>
            <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => borrar(a.id)}>✕</button>
          </span>
        </div>
      ))}
    </div>
  );
}
