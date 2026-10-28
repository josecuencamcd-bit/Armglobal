"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { MODULOS } from "@/lib/modulos";

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
          overflowX: "auto",
          gap: 2,
          padding: "8px 10px",
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
        }}
      >
        {MODULOS.map((m) => {
          const activo = pathname?.startsWith(m.href);
          return (
            <button
              key={m.key}
              onClick={() => m.listo && router.push(m.href)}
              disabled={!m.listo}
              style={{
                flex: "0 0 auto",
                minWidth: 76,
                background: "transparent",
                border: "none",
                color: !m.listo ? "#55555c" : activo ? "var(--accent)" : "var(--muted)",
                fontWeight: activo ? 600 : 500,
                fontSize: "0.75rem",
                padding: "8px 6px",
                cursor: m.listo ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{m.icon}</span>
              <span>{m.label}</span>
              {!m.listo && <span style={{ fontSize: "0.6rem" }}>Pronto</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
