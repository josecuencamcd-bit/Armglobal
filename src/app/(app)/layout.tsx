"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

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

/** Barra inferior de navegación entre módulos — equivalente a
 * `pintarBottomNav()` de la app vieja. Se va sumando un ítem acá por cada
 * módulo que se migra; por ahora solo Encuentros está portado. */
const MODULOS: { key: string; label: string; href: string }[] = [
  { key: "encuentros", label: "Encuentros", href: "/encuentros" },
];

type Perfil = { nombre: string; roles: Rol[]; campus: string | null };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("perfiles")
        .select("nombre, roles, campus")
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

  const rol = perfil ? rolPrincipal(perfil.roles) : null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, letterSpacing: "0.02em" }}>armglobal</div>
          <div style={{ height: 2, width: 56, marginTop: 4, borderRadius: 2, background: "linear-gradient(90deg, #ff9f1c, #ffd24c)" }} />
        </div>
        {perfil && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.85rem" }}>{perfil.nombre}</div>
              <div className="muted" style={{ fontSize: "0.75rem" }}>
                {rol}
                {perfil.campus ? ` · ${perfil.campus}` : ""}
              </div>
            </div>
            <button
              className="boton-peligro"
              onClick={salir}
              style={{ padding: "6px 10px", fontSize: "0.8rem" }}
            >
              Salir
            </button>
          </div>
        )}
      </header>

      <main style={{ flex: 1, paddingBottom: 72 }}>{children}</main>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 4,
          padding: "8px 12px",
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
        }}
      >
        {MODULOS.map((m) => {
          const activo = pathname?.startsWith(m.href);
          return (
            <button
              key={m.key}
              onClick={() => router.push(m.href)}
              style={{
                flex: 1,
                maxWidth: 120,
                background: "transparent",
                border: "none",
                color: activo ? "var(--accent)" : "var(--muted)",
                fontWeight: activo ? 600 : 500,
                fontSize: "0.8rem",
                padding: "8px 4px",
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
