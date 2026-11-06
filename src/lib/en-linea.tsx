"use client";

import { useEffect, useRef, useState } from "react";
import { useCampus } from "@/lib/campus-context";

type Conectado = { nombre: string; campus: string | null };

const INTERVALO_MS = 25_000;

/** Equivalente a renderOnline() de la app vieja: bajo el header, mientras
 * haya sesión, muestra quién más tiene la app abierta en este momento
 * (ver /api/presencia). Se refresca sola cada ~25s; no hace falta que la
 * persona haga nada para aparecer — cualquier pantalla con este badge
 * montado ya la marca presente. */
export function EnLinea() {
  const { campusActivo } = useCampus();
  const [conectados, setConectados] = useState<Conectado[] | null>(null);
  const detenido = useRef(false);

  useEffect(() => {
    detenido.current = false;
    async function marcar() {
      try {
        const res = await fetch("/api/presencia", { method: "POST" });
        const json = await res.json();
        if (!detenido.current && json.ok) setConectados(json.data.conectados);
      } catch {
        // Sin conexión momentánea: se reintenta solo en el próximo ciclo.
      }
    }
    marcar();
    const id = setInterval(marcar, INTERVALO_MS);
    return () => {
      detenido.current = true;
      clearInterval(id);
    };
  }, []);

  if (!conectados || !conectados.length) return null;

  return (
    <div
      aria-live="polite"
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
        fontSize: "0.82rem", color: "var(--muted)", padding: "0 16px 10px",
      }}
    >
      <span>En línea:</span>
      {conectados.map((p, i) => (
        <b
          key={p.nombre + i}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 999, background: "var(--surface-2)",
            color: "var(--ink)", fontWeight: 500,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)", display: "inline-block" }} />
          {p.nombre}
          {p.campus && p.campus !== campusActivo ? ` (${p.campus})` : ""}
        </b>
      ))}
    </div>
  );
}
