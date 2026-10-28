"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { MODULOS } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";

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
      <header className="brandbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: "0.02em" }}>armglobal</div>
          <p className="tagline" style={{ margin: "2px 0 0" }}>
            La <em>Iglesia</em> es mucho más de lo que te dijeron
          </p>
        </div>
        {perfil && (
          <button
            onClick={salir}
            title={`Salir (${perfil.nombre} · ${rol}${perfil.campus ? " · " + perfil.campus : ""})`}
            className="avatar"
            style={{ cursor: "pointer" }}
          >
            {iniciales(perfil.nombre)}
          </button>
        )}
      </header>

      <main style={{ flex: 1, paddingBottom: 76 }}>{children}</main>

      <nav className="bottom-nav">
        {MODULOS.map((m) => {
          const activo = pathname?.startsWith(m.href);
          return (
            <button
              key={m.key}
              onClick={() => m.listo && router.push(m.href)}
              disabled={!m.listo}
              aria-current={activo ? "true" : "false"}
            >
              <Icono id={m.icon} size={21} />
              <span>{m.label}</span>
              {!m.listo && <span style={{ fontSize: "0.56rem", opacity: 0.8 }}>Pronto</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
