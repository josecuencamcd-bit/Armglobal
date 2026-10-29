"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { MODULOS } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";
import { CampusProvider, useCampus } from "@/lib/campus-context";
import { modulosVisibles, CLAVE_A_MODULO_APP } from "@/lib/visibilidad-modulos";

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

/** Mismos 5 ítems directos en la barra inferior que la app vieja —
 * Inicio, Soporte, Bajas, Panorama, Cumpleaños — el resto vive detrás de
 * "Más" (Reuniones, Mi perfil, y la Administración de cada módulo). */
const PRINCIPALES = ["inicio", "soporte", "bajas", "panorama", "cumpleanos"];

type Impersonando = { target: { nombre: string; correo: string } } | null;

function Shell({ children, impersonando }: { children: React.ReactNode; impersonando: Impersonando }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);
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
  const principales = modulosDeEstaPersona.filter((m) => PRINCIPALES.includes(m.key));
  const resto = modulosDeEstaPersona.filter((m) => !PRINCIPALES.includes(m.key));
  const hayActivoEnResto = resto.some((m) => pathname?.startsWith(m.href));

  function ir(href: string) {
    setMasAbierto(false);
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

      <main style={{ flex: 1, paddingBottom: 76 }}>{children}</main>

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

      {masAbierto && (
        <div
          onClick={() => setMasAbierto(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "flex-end", zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hoja-mas"
            style={{
              width: "100%", maxWidth: 480, margin: "0 auto",
              background: "var(--surface-2)", borderTop: "1px solid var(--hud-line)",
              borderRadius: "var(--r-lg) var(--r-lg) 0 0",
              padding: "18px 14px 28px",
            }}
          >
            <p style={{ fontWeight: 700, margin: "0 0 10px", fontSize: "0.9rem" }}>Más opciones</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              {resto.filter((m) => m.key === "reuniones" || m.key === "perfil").map((m) => (
                <button
                  key={m.key}
                  onClick={() => ir(m.href)}
                  className="tarjeta"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", margin: 0 }}
                >
                  <Icono id={m.icon} size={20} />
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                </button>
              ))}
            </div>

            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Administración · {campusActivo}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {resto.filter((m) => m.key !== "reuniones" && m.key !== "perfil").map((m) => {
                const activo = pathname?.startsWith(m.href);
                return (
                  <button
                    key={m.key}
                    onClick={() => m.listo && ir(m.href)}
                    disabled={!m.listo}
                    className="tarjeta"
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: "14px 6px", cursor: m.listo ? "pointer" : "default",
                      opacity: m.listo ? 1 : 0.5,
                      border: activo ? "1px solid var(--accent)" : undefined,
                      margin: 0,
                    }}
                  >
                    <Icono id={m.icon} size={24} />
                    <span style={{ fontSize: "0.78rem", textAlign: "center" }}>{m.label}</span>
                    {!m.listo && <span style={{ fontSize: "0.6rem", opacity: 0.8 }}>Pronto</span>}
                  </button>
                );
              })}
            </div>
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
