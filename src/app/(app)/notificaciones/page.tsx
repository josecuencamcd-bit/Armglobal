"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCampus } from "@/lib/campus-context";

type Item = {
  campus: string;
  encuentro: string;
  fecha: string;
  area: "Reporte" | "Aportes" | "Checklist";
  mensaje: string;
  href: string;
  esResponsable: boolean;
};

/**
 * Bandeja de Notificaciones: encuentros vencidos con alguna de sus tres
 * áreas (Reporte/Aportes/Checklist) todavía sin cerrar. A quien le toca
 * cerrarlo (responsable asignado esa semana) le aparece el botón para ir
 * directo a la pantalla; al resto le llega el mismo ítem, pero solo como
 * información — sin el botón.
 */
export default function NotificacionesPage() {
  const { campusActivo } = useCampus();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setItems(null);
    const res = await fetch(`/api/notificaciones?campus=${encodeURIComponent(campusActivo)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setItems(json.data);
    setError(null);
  }, [campusActivo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem", margin: "0 0 4px" }}>Notificaciones</h1>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.82rem" }}>
        Pendientes de cerrar en encuentros vencidos · Campus {campusActivo}
      </p>

      {error && <p className="aviso">{error}</p>}
      {!items && !error && <p className="muted">Cargando…</p>}
      {items && items.length === 0 && <p className="muted">No hay nada pendiente por ahora.</p>}

      {items?.map((it, i) => (
        <div className="tarjeta" key={i} style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{it.mensaje}</p>
            {!it.esResponsable && (
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>Solo informativo — no eres responsable asignado esta semana.</p>
            )}
          </div>
          {it.esResponsable && (
            <Link href={it.href} className="boton" style={{ flexShrink: 0, padding: "8px 14px", fontSize: "0.82rem" }}>
              Ir
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
