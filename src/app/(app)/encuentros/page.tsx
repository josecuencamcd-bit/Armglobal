"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ENCUENTROS, EVENTOS, proximaFecha } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";

/** Selector de encuentro (tipo/fecha), equivalente a la pantalla inicial
 * del módulo Encuentros en el HTML embebido de Code.gs. El campus ya no
 * se elige acá: viene del contexto de sesión (header / primer ingreso),
 * para que toda la app quede segmentada por el mismo campus a la vez. */
export default function SelectorEncuentroPage() {
  const router = useRouter();
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const [encuentro, setEncuentro] = useState(ENCUENTROS[campus][0]);
  const [evento, setEvento] = useState(EVENTOS[0]);
  // La fecha por defecto siempre corresponde al tipo de encuentro elegido
  // (ver proximaFecha) — así "Abrir" sin tocar nada nunca cae en "Encuentro
  // no válido" por un desfase día/tipo.
  const [fecha, setFecha] = useState(proximaFecha(ENCUENTROS[campus][0]));

  function irA(e: React.FormEvent) {
    e.preventDefault();
    const ev = encuentro === "Evento Especial" ? evento : "";
    const key = [campus, encuentro, ev, fecha].join("|");
    router.push(`/encuentros/${encodeURIComponent(key)}`);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>
          Encuentros
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
