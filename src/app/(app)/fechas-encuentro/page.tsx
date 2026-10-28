"use client";

import { useEffect, useState, useCallback } from "react";

type Fecha = { fecha: string; activo: boolean };

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
function nombreMes(mes: string) {
  const [, m] = mes.split("-").map(Number);
  return MESES[m - 1];
}
function mesMover(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Puerto Natales no tiene encuentro todos los domingos: acá el Pastor marca
 * cuáles sí lo tienen, mes por mes — equivalente a vFechasEncuentro() /
 * api_fechasEncLista / api_fechaEncGuardar de Code.gs (CAMPUS_FECHAS_IRREGULARES). */
export default function FechasEncuentroPage() {
  const [mes, setMes] = useState<string>(new Date().toISOString().slice(0, 7));
  const [fechas, setFechas] = useState<Fecha[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async (m: string) => {
    const res = await fetch(`/api/fechas-encuentro?mes=${encodeURIComponent(m)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setMes(json.data.mes);
    setFechas(json.data.fechas);
    setError(null);
  }, []);

  useEffect(() => {
    cargar(mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar(mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  async function marcar(fecha: string, activo: boolean) {
    setGuardando(fecha);
    const res = await fetch("/api/fechas-encuentro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, activo }),
    });
    const json = await res.json();
    setGuardando(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar(mes);
  }

  if (!fechas && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Fechas de encuentro</h1>
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: -6 }}>
        Puerto Natales · marca qué domingos sí tienen encuentro.
      </p>
      {error && <p className="aviso">{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
        <button className="boton-secundario" onClick={() => setMes((m) => mesMover(m, -1))}>‹</button>
        <strong>{nombreMes(mes)} {mes.slice(0, 4)}</strong>
        <button className="boton-secundario" onClick={() => setMes((m) => mesMover(m, 1))}>›</button>
      </div>

      {fechas?.map((f) => (
        <div className="fila" key={f.fecha}>
          <span>{f.fecha}</span>
          <button
            className={f.activo ? "boton" : "boton-secundario"}
            disabled={guardando === f.fecha}
            onClick={() => marcar(f.fecha, !f.activo)}
          >
            {guardando === f.fecha ? "…" : f.activo ? "Con encuentro" : "Sin encuentro"}
          </button>
        </div>
      ))}
    </div>
  );
}
