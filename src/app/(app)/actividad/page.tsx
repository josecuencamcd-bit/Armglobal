"use client";

import { useEffect, useState } from "react";

type Entrada = {
  id: number;
  en: string;
  actor_correo: string | null;
  actor_nombre: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: Record<string, unknown> | null;
};

const ETIQUETAS: Record<string, string> = {
  perfil_editado: "Editó un perfil",
  encuentro_reabierto: "Reabrió un encuentro",
  encuentro_reapertura_rechazada: "Rechazó reabrir un encuentro",
  fondos_reapertura_ok_pastor: "Dio el Ok para reabrir fondos",
  fondos_reapertura_rechazada_pastor: "Rechazó reabrir fondos (Pastor)",
  fondos_reapertura_aprobada_admin: "Aprobó reabrir fondos",
  fondos_reapertura_rechazada_admin: "Rechazó reabrir fondos (Admin)",
};

/** Actividad: registro de lo que hicieron los administradores (editar
 * perfiles, reabrir un encuentro o un mes de fondos cerrado) — la forma
 * segura de tener la visibilidad que daba "ver en vivo" en la app vieja,
 * sin entrar a la sesión de nadie. Solo Admin app (RLS). */
export default function ActividadPage() {
  const [datos, setDatos] = useState<Entrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/bitacora");
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      setDatos(json.data);
    })();
  }, []);

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Actividad</h1>
      {error && <p className="aviso">{error}</p>}
      {!datos && !error && <p className="muted">Cargando…</p>}
      {datos?.length === 0 && <p className="muted">Sin actividad registrada todavía.</p>}
      {datos?.map((e) => (
        <div className="fila" key={e.id}>
          <div>
            <div>{ETIQUETAS[e.accion] ?? e.accion}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>
              {e.actor_nombre ?? e.actor_correo ?? "—"} · {new Date(e.en).toLocaleString("es-CL")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
