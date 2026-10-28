"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";
import { useCampus } from "@/lib/campus-context";

/** Grupos del dashboard — mismas funciones, pero organizadas por tema en
 * vez de un muro de 10 cuadros iguales (pedido: "que sea ordenado, sin
 * tener que estar scrolleando para buscar todo"). */
const GRUPOS: { titulo: string; claves: string[] }[] = [
  { titulo: "Hoy", claves: ["encuentros", "soporte"] },
  { titulo: "Dinero", claves: ["fondos", "finanzas"] },
  { titulo: "Equipo", claves: ["equipos", "turnos", "visitas"] },
  { titulo: "Personas", claves: ["perfiles", "cumpleanos", "reuniones"] },
];

export default function InicioPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");
  const { campusActivo } = useCampus();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle();
      if (!cancelado && data) setNombre(data.nombre.split(" ")[0]);
    })();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  const porClave = new Map(MODULOS.map((m) => [m.key, m]));

  return (
    <div className="contenedor" style={{ paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 className="titulo" style={{ fontSize: "1.5rem", margin: 0 }}>
          Hola{nombre ? `, ${nombre}` : ""}
        </h1>
        <span className="muted" style={{ fontSize: "0.8rem" }}>{campusActivo}</span>
      </div>

      {GRUPOS.map((g) => {
        const tiles = g.claves.map((k) => porClave.get(k)).filter((m): m is Modulo => !!m);
        if (tiles.length === 0) return null;
        return (
          <div key={g.titulo} style={{ marginBottom: 20 }}>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {g.titulo}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {tiles.map((m) => (
                <button
                  key={m.key}
                  onClick={() => m.listo && router.push(m.href)}
                  disabled={!m.listo}
                  className="tarjeta"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 6,
                    cursor: m.listo ? "pointer" : "default",
                    opacity: m.listo ? 1 : 0.5,
                    textAlign: "left",
                    margin: 0,
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>
                    <Icono id={m.icon} size={24} />
                  </span>
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  {!m.listo && <span className="muted">Pronto</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
