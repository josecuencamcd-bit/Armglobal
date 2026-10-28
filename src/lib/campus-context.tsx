"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CAMPUS } from "@/lib/sesiones";

type CampusValor = (typeof CAMPUS)[number];

const CLAVE = "armglobal_campus_activo";

type CampusCtx = {
  /** Campus que se está viendo/gestionando en este momento. */
  campusActivo: CampusValor;
  /** true si la persona tiene acceso a ambos campus y puede cambiar. */
  puedeElegir: boolean;
  /** Reabre el selector de campus (solo tiene efecto si puedeElegir). */
  elegirCampus: () => void;
};

const Ctx = createContext<CampusCtx>({
  campusActivo: CAMPUS[0],
  puedeElegir: false,
  elegirCampus: () => {},
});

/** Sesión de campus, equivalente al flujo de la app vieja: si la persona
 * tiene campus fijo, todo queda filtrado por ese campus siempre. Si no
 * (campus=null, "ambos campus"), se le pregunta qué campus va a
 * gestionar al entrar y esa elección segmenta el resto de la app hasta
 * que la cambie. */
export function CampusProvider({
  campusFijo,
  children,
}: {
  campusFijo: CampusValor | null;
  children: React.ReactNode;
}) {
  const puedeElegir = campusFijo === null;
  const [elegido, setElegido] = useState<CampusValor | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!puedeElegir) {
      setListo(true);
      return;
    }
    const guardado = typeof window !== "undefined" ? window.localStorage.getItem(CLAVE) : null;
    if (guardado && (CAMPUS as readonly string[]).includes(guardado)) {
      setElegido(guardado as CampusValor);
    }
    setListo(true);
  }, [puedeElegir]);

  const elegir = useCallback(
    (c: CampusValor) => {
      setElegido(c);
      try {
        window.localStorage.setItem(CLAVE, c);
      } catch {
        /* localStorage puede fallar en privado; no es crítico */
      }
    },
    []
  );

  if (!listo) return null;

  if (puedeElegir && !elegido) {
    return (
      <div className="selector-campus">
        <div>
          <p style={{ fontWeight: 700, fontSize: "1.2rem", margin: "0 0 6px" }}>¿Qué campus vas a gestionar hoy?</p>
          <p className="muted" style={{ margin: "0 0 20px" }}>Tienes acceso a ambos. Puedes cambiarlo cuando quieras.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CAMPUS.map((c) => (
              <button key={c} className="boton" onClick={() => elegir(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider
      value={{
        campusActivo: campusFijo ?? elegido ?? CAMPUS[0],
        puedeElegir,
        elegirCampus: () => puedeElegir && setElegido(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCampus() {
  return useContext(Ctx);
}
