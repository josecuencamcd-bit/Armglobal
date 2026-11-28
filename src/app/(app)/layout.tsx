"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";
import { CampusProvider, useCampus } from "@/lib/campus-context";
import { EnLinea } from "@/lib/en-linea";
import { modulosVisibles, clavesPrincipalesNav, adminSubnav, esPastorC, CLAVE_A_MODULO_APP, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";

/** Inverso de CLAVE_A_MODULO_APP: de una clave vieja (tabsPorRol) a
 * nuestra clave de módulo real — incluye "administracion" (su tile real
 * es /administracion), así que puede caer en "Más" como cualquier otro. */
const MODULO_APP_A_CLAVE: Record<string, string> = Object.fromEntries(
  Object.entries(CLAVE_A_MODULO_APP).map(([clave, claveVieja]) => [claveVieja, clave])
);

/** Ícono por clave de ADMIN_SUBNAV, igual que el mapa usado en /administracion. */
const ICONO_POR_CLAVE_ADMIN: Record<string, string> = {
  "administracion-semanal": "administracionSemanal", fondos: "fondo", reportes: "finanzas", fechas: "administracionSemanal",
  equipo: "equipo", asistencia: "asistencia", fondo: "fondo", visitas: "visitas",
  solicitudes: "bajas", equipostats: "actividad", reporte: "asistencia", aportes: "aportes",
  amor: "fondo",
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
  foto_url: string | null;
};

type Impersonando = { target: { nombre: string; correo: string } } | null;

function Shell({ children, impersonando }: { children: React.ReactNode; impersonando: Impersonando }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);
  // Respaldo del gesto de deslizar en "Más opciones": en algunos celulares
  // el swipe dentro de la hoja no engancha (reporte de José, 28-nov — no
  // llegaba a ver "Administración", el último ítem, abajo del todo). El
  // botón de abajo mueve el scroll con JS sin depender del gesto táctil.
  const masListaRef = useRef<HTMLDivElement>(null);
  const [menuAdminAbierto, setMenuAdminAbierto] = useState(false);
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const { campusActivo, puedeElegir, elegirCampus } = useCampus();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      // /api/perfil ya resuelve "vista como X" (identidadActuante) — antes
      // esto consultaba perfiles directo con el usuario REAL de la sesión,
      // por lo que el avatar (foto, rol, módulos) mostraba a José y no a la
      // persona que se está viendo durante una prueba.
      const res = await fetch("/api/perfil");
      const json = await res.json();
      if (!cancelado && json.ok) setPerfil(json.data as Perfil);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

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
  // tienen equivalente ahí NUNCA van sueltos en el nav global ni en "Más":
  // "administracion-semanal"/"fechas-encuentro" solo se abren DESDE
  // Administración (ADMIN_SUBNAV, exclusivo de Pastor/Pastor de campus);
  // "perfiles"/"actividad" solo se abren DESDE Soporte (su propia grilla
  // de tiles). Antes, al no tener claveVieja, el filtro de abajo los
  // dejaba SIEMPRE visibles para cualquier rol — ese bypass era el "menú
  // con mil botones".
  const SOLO_DESDE_OTRA_PANTALLA = new Set(["administracion-semanal", "fechas-encuentro", "perfiles", "actividad"]);
  const visibles = perfil
    ? modulosVisibles({ roles: perfil.roles, areas: perfil.areas, sirve: perfil.sirve, modulos_on: perfil.modulos_on, modulos_off: perfil.modulos_off })
    : null;
  // pintarBottomNav() de la app vieja nunca lista "reporte"/"aportes" para
  // quien no es Pastor de campus (Ministro/Administrador solo los abren
  // DESDE Administración) — ni sueltos ni detrás de "Más". Antes acá solo
  // se excluían de los 4 sueltos (clavesPrincipalesNav), así que se colaban
  // en "Más" para esos roles; eso era el "menú con mil botones".
  const esPastorCampus = perfil ? esPastorC({ roles: perfil.roles, areas: perfil.areas, sirve: perfil.sirve, modulos_on: perfil.modulos_on, modulos_off: perfil.modulos_off }) : false;
  const modulosDeEstaPersona = MODULOS.filter((m) => {
    if (SOLO_DESDE_OTRA_PANTALLA.has(m.key)) return false;
    const claveVieja = CLAVE_A_MODULO_APP[m.key];
    if ((claveVieja === "aportes" || claveVieja === "reporte") && !esPastorCampus) return false;
    if (!claveVieja || !visibles) return true;
    return visibles.has(claveVieja);
  });
  // pintarBottomNav(): Inicio + las 4 claves de mayor prioridad que esta
  // persona tiene visibles van sueltas en la barra; el resto (Reuniones,
  // Mi perfil y lo que no entró en esas 4) queda detrás de "Más".
  // "administracion" nunca va a la barra suelta (en la app vieja tampoco:
  // no está en PRIORIDAD_NAV) — se excluye acá de forma directa, sin pasar
  // por el vaivén de ida y vuelta entre las dos tablas de claves, para que
  // nunca dependa de ese cálculo. A pedido de José (27-11, caso detectado
  // en el perfil de Aline/"Ali": terminaba con Cumpleaños y Reuniones
  // sueltos en vez de Merch, porque PRIORIDAD_NAV varía según qué tenga
  // visible cada persona) la barra suelta queda ESTANDARIZADA para
  // cualquier rol: Inicio + Mi equipo (si aplica) + Merch + Más. Todo lo
  // demás vive solo dentro de "Más", nunca suelto — por eso esto es una
  // lista BLANCA (solo "equipos" puede ir suelto) y no una lista negra de
  // claves a excluir: con un blocklist, cualquier módulo nuevo que no
  // estuviera explícitamente ahí se colaba suelto para quien lo tuviera
  // como más prioritario (así se detectó el caso de Aline — con
  // Fondo/Asistencia ocultos, Cumpleaños/Reuniones ganaban un lugar suelto
  // en vez de Merch; con este cambio de enfoque, ningún módulo futuro de
  // PRIORIDAD_NAV puede volver a colarse de la misma forma, sea cual sea
  // la combinación de rol/área).
  const UNICA_SUELTA_PERMITIDA = "equipos";
  const clavesPrincipales = perfil
    ? clavesPrincipalesNav({ roles: perfil.roles, areas: perfil.areas, sirve: perfil.sirve, modulos_on: perfil.modulos_on, modulos_off: perfil.modulos_off })
        .map((cv) => MODULO_APP_A_CLAVE[cv])
        .filter((k): k is string => k === UNICA_SUELTA_PERMITIDA)
    : [];
  const principalesBase = [
    modulosDeEstaPersona.find((m) => m.key === "inicio"),
    ...clavesPrincipales.map((k) => modulosDeEstaPersona.find((m) => m.key === k)).filter((m): m is Modulo => !!m),
  ].filter((m): m is Modulo => !!m);
  // "merch-catalogo" no tiene claveVieja (CLAVE_A_MODULO_APP), así que
  // nunca pasa por PRIORIDAD_NAV/clavesPrincipalesNav — a pedido de José
  // va siempre suelto en la barra (Inicio · Mi equipo · Merch · Más), para
  // todos los roles, igual que el parche de "administracion" en Más más
  // abajo: se agrega acá directo en vez de depender de ese cálculo.
  const merchModulo = modulosDeEstaPersona.find((m) => m.key === "merch-catalogo");
  const principales = merchModulo && !principalesBase.some((m) => m.key === "merch-catalogo")
    ? [...principalesBase, merchModulo]
    : principalesBase;
  const resto = modulosDeEstaPersona.filter((m) => !principales.some((p) => p.key === m.key));
  const tieneAdministracion = !!visibles?.has("administracion");
  // Red de seguridad: si por lo que sea "administracion" no llegó por el
  // camino normal (modulosDeEstaPersona/resto), la agregamos directo acá —
  // nunca debe depender de un solo cálculo para aparecer en "Más".
  const restoFinal = tieneAdministracion && !resto.some((m) => m.key === "administracion")
    ? [...resto, MODULOS.find((m) => m.key === "administracion")!]
    : resto;
  const hayActivoEnResto = restoFinal.some((m) => pathname?.startsWith(m.href));

  // pintarBottomNav() de la app vieja: la barra no aparece en los tabs
  // "aportes"/"reporte" — AMBOS del encuentro puntual (registrar su
  // asistencia/reporte/aportes), no del informe mensual. "Reporte" (clave
  // "finanzas" en MODULOS, clave "reporte" en ADMIN_SUBNAV) abre /encuentros
  // (el mismo tab-reporte de la app vieja), nunca /finanzas — el informe
  // MENSUAL (vFinanzas) solo se abre vía "Reportes" (plural, Pastor/Pastor
  // de campus, dentro de Administración). "estadisticas" (equipostats, Mi
  // equipo) es una pantalla distinta que sí mantiene la barra normal —
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
              onClick={() => setMenuPerfilAbierto(true)}
              title={`${perfil.nombre} · ${rol}`}
              className="avatar"
              style={{ cursor: "pointer", padding: 0, overflow: "hidden" }}
            >
              {perfil.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                iniciales(perfil.nombre)
              )}
            </button>
          )}
        </div>
      </header>

      {perfil && <EnLinea />}

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

      {menuPerfilAbierto && perfil && (
        <div
          onClick={() => setMenuPerfilAbierto(false)}
          className="nav-sheet"
        >
          <div onClick={(e) => e.stopPropagation()} className="nav-sheet-card">
            <div className="nav-sheet-head">
              <b>{perfil.nombre}</b>
              <button type="button" onClick={() => setMenuPerfilAbierto(false)}>✕</button>
            </div>
            <button
              onClick={() => {
                setMenuPerfilAbierto(false);
                ir("/perfil");
              }}
              className="nav-sheet-item"
            >
              <b>Mi perfil</b>
            </button>
            <button
              onClick={() => {
                setMenuPerfilAbierto(false);
                salir();
              }}
              className="nav-sheet-item"
            >
              <b>Cerrar sesión</b>
            </button>
          </div>
        </div>
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
          <div onClick={(e) => e.stopPropagation()} className="nav-sheet-card" ref={masListaRef}>
            <div className="nav-sheet-head">
              <b>Más opciones</b>
              <button type="button" onClick={() => setMasAbierto(false)}>✕</button>
            </div>
            {restoFinal.length > 3 && (
              <button
                type="button"
                onClick={() => masListaRef.current?.scrollBy({ top: 220, behavior: "smooth" })}
                className="muted"
                style={{ fontSize: "0.68rem", textAlign: "center", padding: "0 4px 4px", background: "none", border: 0, width: "100%", cursor: "pointer" }}
              >
                Ver más opciones ↓
              </button>
            )}
            {restoFinal.map((m) => {
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
