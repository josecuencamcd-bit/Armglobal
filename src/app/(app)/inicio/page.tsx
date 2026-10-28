"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULOS } from "@/lib/modulos";

/** Pantalla de inicio: equivalente a la vista "Hola, {nombre}" de la app
 * vieja — tagline + tarjetas de acceso directo a cada módulo. */
export default function InicioPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");

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

  const tiles = MODULOS.filter((m) => m.key !== "inicio");

  return (
    <div className="contenedor" style={{ paddingTop: 28 }}>
      <h1 className="titulo" style={{ fontSize: "1.5rem" }}>
        Hola{nombre ? `, ${nombre}` : ""}
      </h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
        La <em>Iglesia</em> es mucho más de lo que te dijeron
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
        }}
      >
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
              border: "1px solid var(--line)",
              cursor: m.listo ? "pointer" : "default",
              opacity: m.listo ? 1 : 0.5,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>{m.icon}</span>
            <span style={{ fontWeight: 600 }}>{m.label}</span>
            {!m.listo && <span className="muted">Pronto</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
