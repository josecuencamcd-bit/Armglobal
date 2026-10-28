"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAMPUS, ENCUENTROS, EVENTOS, hoy } from "@/lib/sesiones";

/** Selector de encuentro (campus/tipo/fecha), equivalente a la pantalla
 * inicial del módulo Encuentros en el HTML embebido de Code.gs. */
export default function SelectorEncuentroPage() {
  const router = useRouter();
  const [campus, setCampus] = useState<(typeof CAMPUS)[number]>(CAMPUS[0]);
  const [encuentro, setEncuentro] = useState(ENCUENTROS[CAMPUS[0]][0]);
  const [evento, setEvento] = useState(EVENTOS[0]);
  const [fecha, setFecha] = useState(hoy());

  function irA(e: React.FormEvent) {
    e.preventDefault();
    const ev = encuentro === "Evento Especial" ? evento : "";
    const key = [campus, encuentro, ev, fecha].join("|");
    router.push(`/encuentros/${encodeURIComponent(key)}`);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 32 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>
        Encuentros
      </h1>
      <form className="tarjeta" onSubmit={irA}>
        <div className="campo">
          <label htmlFor="campus">Campus</label>
          <select
            id="campus"
            value={campus}
            onChange={(e) => {
              const c = e.target.value as (typeof CAMPUS)[number];
              setCampus(c);
              setEncuentro(ENCUENTROS[c][0]);
            }}
          >
            {CAMPUS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="encuentro">Encuentro</label>
          <select id="encuentro" value={encuentro} onChange={(e) => setEncuentro(e.target.value)}>
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
