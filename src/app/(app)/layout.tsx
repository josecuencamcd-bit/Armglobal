"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";
import { CampusProvider, useCampus } from "@/lib/campus-context";
import { modulosVisibles, clavesPrincipalesNav, adminSubnav, CLAVE_A_MODULO_APP, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";

/** Inverso de CLAVE_A_MODULO_APP: de una clave vieja (tabsPorRol) a
 * nuestra clave de módulo real. Una clave vieja sin tile propio acá
 * (p. ej. "administracion", que en la app vieja es un selector de campus
 * + subnav, reemplazado en esta migración por el toggle de campus que ya
 * trae cada pantalla) simplemente no aparece en la barra. */
const MODULO_APP_A_CLAVE: Record<string, string> = Object.fromEntries(
  Object.entries(CLAVE_A_MODULO_APP).map(([clave, claveVieja]) => [claveVieja, clave])
);

/** Ícono por clave de ADMIN_SUBNAV, igual que el mapa usado en /administracion. */
const ICONO_POR_CLAVE_ADMIN: Record<string, string> = {
  turnos: "turnos", fondos: "fondo", reportes: "finanzas", fechas: "turnos",
  equipo: "equipo", asistencia: "asistencia", fondo: "fondo", visitas: "visitas",
  solicitudes: "bajas", equipostats: "actividad", reporte: "finanzas", aportes: "aportes",
};

type Rol = Database["public"]["Enums"]["rol_t"];

/** Mismo orden de jerarquía que la app vieja (client.js `rolPrincipal()`):
 * se muestra solo el rol más alto de la persona, no todos los que tenga. */
const ROLES_ORDEN: Rol[] = [
  "Pastor principal",
  "Pastor de campus",
  "Pastor",
  "Ministro",
  "Administrador",
  "Líder",
  "Voluntario",
  "Admin app",
];

function rolPrincipal(roles: Rol[]): Rol | null {
  for (const r of ROLES_ORDEN) if (roles.includes(r)) return r;
  return roles[0] ?? null;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type Area = Database["public"]["Enums"]["area_t"];
type Perfil = {
  nombre: string;
  roles: Rol[];
  campus: "Punta Arenas" | "Puerto Natales" | null;
  areas: Area[];
  sirve: Area[];
  modulos_on: string[];
  modulos_off: string[];
};

type Impersonando = { target: { nombre: string; correo: string } } | null;

function Shell({ children, impersonando }: { children: React.ReactNode; impersonando: Impersonando }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);
  const [menuAdminAbierto, setMenuAdminAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const { campusActivo, puedeElegir, elegirCampus } = useCampus();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("perfiles")
        .select("nombre, roles, campus, areas, sirve, modulos_on, modulos_off")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelado && data) setPerfil(data as Perfil);
    })();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function salirDeLaVista() {
    setSaliendo(true);
    await fetch("/api/admin/impersonar", { method: "DELETE" });
    router.refresh();
    window.location.href = "/inicio";
  }

  const rol = perfil ? rolPrincipal(perfil.roles) : null;
  // Qué tiles muestra realmente esta persona: los módulos que mapean a la
  // lista vieja (CLAVE_A_MODULO_APP) se filtran por su rol + lo que un
  // Admin app haya activado/desactivado para ella en /perfiles. Los que no
  // tienen equivalente ahí (turnos, perfiles, actividad, etc.) se quedan
  // visibles como antes.
  const visibles = perfil
    ? modulosVisibles({ roles: perfil.roles, areas: perfil.areas, sirve: perfil.sirve, modulos_on: perfil.modulos_on, modulos_off: perfil.modulos_off })
    : null;
  const modulosDeEstaPersona = MODULOS.filter((m) => {
    const claveVieja = CLAVE_A_MODULO_APP[m.key];
    if (!claveVieja || !visibles) return true;
    return visibles.has(claveVieja);
  });
  // pintarBottomNav(): Inicio + las 4 claves de mayor prioridad que esta
  // persona tiene visibles van sueltas en la barra; el resto (Reuniones,
  // Mi perfil y lo que no entró en esas 4) queda detrás de "Más".
  const clavesPrincipales = perfil
    ? clavesPrincipalesNav({ roles: perfil.roles, areas: perfil.areas, sirve: perfil.sirve, modulos_on: perfil.modulos_on, modulos_off: perfil.modulos_off })
        .map((cv) => MODULO_APP_A_CLAVE[cv])
        .filter((k): k is string => !!k)
    : [];
  const principales = [
    modulosDeEstaPersona.find((m) => m.key === "inicio"),
    ...clavesPrincipales.map((k) => modulosDeEstaPersona.find((m) => m.key === k)).filter((m): m is Modulo => !!m),
  ].filter((m): m is Modulo => !!m);
  const resto = modulosDeEstaPersona.filter((m) => !principales.some((p) => p.key === m.key));
  const hayActivoEnResto = resto.some((m) => pathname?.startsWith(m.href));

  // pintarBottomNav() de la app vieja: la barra no aparece en los tabs
  // "aportes"/"reporte" DEL ENCUENTRO (registrar asistencia/aportes de una
  // sesión puntual) — nuestras /encuentros/[key] y /encuentros/[key]/aportes
  // y el selector dedicado /encuentros/aportes. OJO: "reporte"/"finanzas"
  // (el informe MENSUAL, vFinanzas) y "estadisticas" (equipostats, Mi
  // equipo) son pantallas distintas que sí mantienen la barra normal —
  // "stats" (la de Panorama) es la única que la oculta y no tiene pantalla
  // propia todavía en esta migración.
  const navOculta = !!pathname && pathname.startsWith("/encuentros/") && pathname !== "/encuentros";

  // Dentro de "Administración" la barra cambia a Inicio/Volver/Menú (el
  // campus abre la hoja con ADMIN_SUBNAV), en vez de la barra normal.
  const enAdministracion = pathname === "/administracion";
  const itemsAdmin: { clave: string; label: string; href: string }[] =
    enAdministracion && perfil
      ? adminSubnav(
          { roles: perfil.roles, areas: perfil.areas, sirve: perfil.sirve, modulos_on: perfil.modulos_on, modulos_off: perfil.modulos_off } as PerfilVisibilidad,
          campusActivo
        )
      : [];

  function ir(href: string) {
    setMasAbierto(false);
    setMenuAdminAbierto(false);
    router.push(href);
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header className="brandbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, letterSpacing: "0.02em" }}>armglobal</div>
          <p className="tagline" style={{ margin: "2px 0 0" }}>
            La <em>Iglesia</em> es mucho más de lo que te dijeron
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={elegirCampus}
            disabled={!puedeElegir}
            title={puedeElegir ? "Tocar para cambiar de campus" : undefined}
            style={{
              background: "var(--glass-2)",
              border: "1px solid var(--hud-line)",
              borderRadius: 999,
              color: "var(--ink)",
              fontSize: "0.72rem",
              fontWeight: 600,
              padding: "5px 10px",
              cursor: puedeElegir ? "pointer" : "default",
              whiteSpace: "nowrap",
            }}
          >
            {campusActivo}{puedeElegir ? " ▾" : ""}
          </button>
          {perfil && (
            <button
              onClick={salir}
              title={`Salir (${perfil.nombre} · ${rol})`}
              className="avatar"
              style={{ cursor: "pointer" }}
            >
              {iniciales(perfil.nombre)}
            </button>
          )}
        </div>
      </header>

      {impersonando && (
        <div
          style={{
            position: "sticky", top: 0, zIndex: 45, display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 10, padding: "8px 14px",
            background: "var(--accent)", color: "var(--accent-ink)", fontSize: "0.8rem", fontWeight: 600,
          }}
        >
          <span>Vista de {impersonando.target.nombre} · lo que registres queda guardado a su nombre.</span>
          <button
            onClick={salirDeLaVista}
            disabled={saliendo}
            style={{
              background: "rgba(0,0,0,0.15)", border: 0, borderRadius: 999, color: "inherit",
              fontWeight: 700, fontSize: "0.78rem", padding: "5px 12px", cursor: "pointer", flexShrink: 0,
            }}
          >
            {saliendo ? "…" : "Salir de la vista"}
          </button>
        </div>
      )}

      <main style={{ flex: 1, paddingBottom: navOculta ? 0 : 76 }}>{children}</main>

      {!navOculta && enAdministracion && (
        <nav className="bottom-nav">
          <button onClick={() => ir("/inicio")} aria-current="false">
            <Icono id="inicio" size={21} />
            <span>Inicio</span>
          </button>
          <button onClick={() => router.back()} aria-current="false">
            <Icono id="volver" size={21} />
            <span>Volver</span>
          </button>
          <button onClick={() => setMenuAdminAbierto(true)} aria-current="true">
            <Icono id="menu" size={21} />
            <span>{campusActivo}</span>
          </button>
        </nav>
      )}

      {!navOculta && !enAdministracion && (
        <nav className="bottom-nav">
          {principales.map((m) => {
            const activo = pathname?.startsWith(m.href);
            return (
              <button
                key={m.key}
                onClick={() => m.listo && ir(m.href)}
                disabled={!m.listo}
                aria-current={activo ? "true" : "false"}
              >
                <Icono id={m.icon} size={21} />
                <span>{m.label}</span>
                {!m.listo && <span style={{ fontSize: "0.56rem", opacity: 0.8 }}>Pronto</span>}
              </button>
            );
          })}
          <button onClick={() => setMasAbierto(true)} aria-current={hayActivoEnResto ? "true" : "false"}>
            <Icono id="mas" size={21} />
            <span>Más</span>
          </button>
        </nav>
      )}

      {menuAdminAbierto && (
        <div
          onClick={() => setMenuAdminAbierto(false)}
          className="nav-sheet"
        >
          <div onClick={(e) => e.stopPropagation()} className="nav-sheet-card">
            <div className="nav-sheet-head">
              <b>Administración · {campusActivo}</b>
              <button type="button" onClick={() => setMenuAdminAbierto(false)}>✕</button>
            </div>
            {itemsAdmin.map((it) => (
              <button key={it.clave} onClick={() => ir(it.href)} className="nav-sheet-item">
                <span className="ic"><Icono id={ICONO_POR_CLAVE_ADMIN[it.clave] ?? "administracion"} size={20} /></span>
                <b>{it.label}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {masAbierto && (
        <div
          onClick={() => setMasAbierto(false)}
          className="nav-sheet"
        >
          <div onClick={(e) => e.stopPropagation()} className="nav-sheet-card">
            <div className="nav-sheet-head">
              <b>Más opciones</b>
              <button type="button" onClick={() => setMasAbierto(false)}>✕</button>
            </div>
            {resto.map((m) => {
              const activo = pathname?.startsWith(m.href);
              return (
                <button
                  key={m.key}
                  onClick={() => m.listo && ir(m.href)}
                  disabled={!m.listo}
                  className="nav-sheet-item"
                  aria-current={activo ? "true" : "false"}
                  style={{ opacity: m.listo ? 1 : 0.5 }}
                >
                  <span className="ic"><Icono id={m.icon} size={20} /></span>
                  <b>{m.label}</b>
                  {!m.listo && <span className="muted" style={{ fontSize: "0.68rem", marginLeft: "auto" }}>Pronto</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [campusFijo, setCampusFijo] = useState<"Punta Arenas" | "Puerto Natales" | null | undefined>(undefined);
  const [impersonando, setImpersonando] = useState<Impersonando>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Si hay una "vista como X" activa, el campus (y todo lo demás que
      // ve esta sesión) pasa a ser el de X, no el del Admin app real —
      // ese es justo el punto de "Ver la app como X".
      const resImp = await fetch("/api/admin/impersonar");
      const jsonImp = await resImp.json();
      if (cancelado) return;

      if (jsonImp.ok && jsonImp.data.activo && jsonImp.data.target) {
        setImpersonando({ target: { nombre: jsonImp.data.target.nombre, correo: jsonImp.data.target.correo } });
        setCampusFijo(jsonImp.data.target.campus ?? null);
        return;
      }

      const { data } = await supabase.from("perfiles").select("campus").eq("id", user.id).maybeSingle();
      if (!cancelado) {
        setImpersonando(null);
        setCampusFijo((data?.campus as "Punta Arenas" | "Puerto Natales" | null) ?? null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  if (campusFijo === undefined) return null;

  return (
    <CampusProvider campusFijo={campusFijo}>
      <Shell impersonando={impersonando}>{children}</Shell>
    </CampusProvider>
  );
}
