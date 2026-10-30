"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ENCUENTROS, EVENTOS, proximaFecha } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";

/** Selector de encuentro para Aportes — misma pantalla de Encuentro/Fecha
 * que el selector de Asistencia, pero entra directo a
 * /encuentros/[key]/aportes en vez de pasar primero por el Reporte, igual
 * que el tab "aportes" de la app vieja (acceso propio, no un paso extra
 * dentro del tab "reporte"). */
export default function SelectorAportesPage() {
  const router = useRouter();
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const [encuentro, setEncuentro] = useState(ENCUENTROS[campus][0]);
  const [evento, setEvento] = useState(EVENTOS[0]);
  const [fecha, setFecha] = useState(proximaFecha(ENCUENTROS[campus][0]));

  function irA(e: React.FormEvent) {
    e.preventDefault();
    const ev = encuentro === "Evento Especial" ? evento : "";
    const key = [campus, encuentro, ev, fecha].join("|");
    router.push(`/encuentros/${encodeURIComponent(key)}/aportes`);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>
          Aportes
        </h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campus}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>
      <form className="tarjeta" onSubmit={irA}>
        <div className="campo">
          <label htmlFor="encuentro">Encuentro</label>
          <select
            id="encuentro"
            value={encuentro}
            onChange={(e) => {
              setEncuentro(e.target.value);
              setFecha(proximaFecha(e.target.value));
            }}
          >
            {ENCUENTROS[campus].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {encuentro === "Evento Especial" && (
          <div className="campo">
            <label htmlFor="evento">Evento</label>
            <select id="evento" value={evento} onChange={(e) => setEvento(e.target.value)}>
              {EVENTOS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="campo">
          <label htmlFor="fecha">Fecha</label>
          <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <button className="boton" type="submit">
          Abrir
        </button>
      </form>
    </div>
  );
}
