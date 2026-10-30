"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icono } from "@/lib/iconos";
import { useCampus } from "@/lib/campus-context";
import { adminSubnav, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";

const ICONO_POR_CLAVE: Record<string, string> = {
  turnos: "turnos", fondos: "fondo", reportes: "finanzas", fechas: "turnos",
  equipo: "equipo", asistencia: "asistencia", fondo: "fondo", visitas: "visitas",
  solicitudes: "bajas", equipostats: "actividad", reporte: "finanzas", aportes: "aportes",
};

/**
 * Administración: puerta única por campus a lo que el rol de esta persona
 * no ve suelto en el menú — igual que ADMIN_SUBNAV/adminSubnavPara() de la
 * app vieja. Para Ministro/Administrador es la única forma de llegar a Mi
 * equipo/Asistencia/Fondo de equipo/Conexión/Bajas/Estadísticas/Reporte/
 * Aportes (su rol los saca del menú normal); para Pastor/Pastor de campus,
 * a Turnos/Fondos/Reportes/Fechas de encuentro. El campus es el mismo
 * selector global del header (acá no se elige aparte, como en la vieja).
 */
export default function AdministracionPage() {
  const router = useRouter();
  const supabase = createClient();
  const { campusActivo, puedeElegir, elegirCampus } = useCampus();
  const [perfil, setPerfil] = useState<PerfilVisibilidad | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("perfiles")
        .select("roles, areas, sirve, modulos_on, modulos_off")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelado && data) setPerfil(data as unknown as PerfilVisibilidad);
    })();
    return () => { cancelado = true; };
  }, [supabase]);

  if (!perfil) return <div className="contenedor">Cargando…</div>;

  const items = adminSubnav(perfil, campusActivo);

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Administración</h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campusActivo}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>

      {items.length === 0 && <p className="muted">No hay secciones disponibles para tu perfil en este campus.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 16 }}>
        {items.map((it) => (
          <button
            key={it.clave}
            onClick={() => router.push(it.href)}
            className="tarjeta"
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
              cursor: "pointer", textAlign: "left", margin: 0,
            }}
          >
            <span style={{ color: "var(--accent)" }}>
              <Icono id={ICONO_POR_CLAVE[it.clave] ?? "actividad"} size={24} />
            </span>
            <span style={{ fontWeight: 600 }}>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
