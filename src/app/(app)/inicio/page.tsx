"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";
import { useCampus } from "@/lib/campus-context";
import { modulosVisibles, CLAVE_A_MODULO_APP, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";

/** Grupos del dashboard — mismas funciones, pero organizadas por tema en
 * vez de un muro de 10 cuadros iguales (pedido: "que sea ordenado, sin
 * tener que estar scrolleando para buscar todo"). */
const GRUPOS: { titulo: string; claves: string[] }[] = [
  { titulo: "Hoy", claves: ["encuentros", "panorama"] },
  { titulo: "Dinero", claves: ["fondos", "finanzas"] },
  { titulo: "Equipo", claves: ["equipos", "turnos", "visitas"] },
  { titulo: "Administración", claves: ["soporte", "bajas", "perfiles"] },
  { titulo: "Personas", claves: ["cumpleanos", "reuniones", "perfil"] },
];

/** Lunes ISO de la semana que contiene `fecha` (mismo criterio que
 * lunesDe_ en Code.gs / turnos/page.tsx). */
function lunesDe(fecha: Date): string {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
}

type MiTurno = { semana: string; campus: string };
type Avisos = {
  encuentros: { campus: string; encuentro: string; fecha: string; key: string }[];
  notas: { campus: string; area: string; fecha: string; key: string }[];
  total: number;
};

export default function InicioPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");
  const { campusActivo } = useCampus();
  const [miTurno, setMiTurno] = useState<MiTurno | null | undefined>(undefined);
  const [avisos, setAvisos] = useState<Avisos | null>(null);
  const [visibles, setVisibles] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("perfiles")
        .select("nombre, roles, areas, sirve, modulos_on, modulos_off")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelado || !data) return;
      setNombre(data.nombre.split(" ")[0]);
      setVisibles(modulosVisibles(data as unknown as PerfilVisibilidad));
    })();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const res = await fetch("/api/turnos/mios");
      const json = await res.json();
      if (cancelado) return;
      if (!json.ok) { setMiTurno(null); return; }
      const semanaActual = lunesDe(new Date());
      const match = (json.data as MiTurno[]).find((t) => t.semana === semanaActual && t.campus === campusActivo);
      setMiTurno(match ?? null);
    })();
    return () => {
      cancelado = true;
    };
  }, [campusActivo]);

  useEffect(() => {
    fetch("/api/avisos").then((r) => r.json()).then((json) => {
      if (json.ok) setAvisos(json.data);
    });
  }, []);

  // Mismo filtro que el menú inferior (ver layout): un tile mapeado a un
  // módulo de la lista vieja solo se muestra si esta persona lo tiene
  // visible por rol o por lo que el Admin app haya ajustado en /perfiles.
  const modulosVisiblesAqui = MODULOS.filter((m) => {
    const claveVieja = CLAVE_A_MODULO_APP[m.key];
    if (!claveVieja || !visibles) return true;
    return visibles.has(claveVieja);
  });
  const porClave = new Map(modulosVisiblesAqui.map((m) => [m.key, m]));

  return (
    <div className="contenedor" style={{ paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 className="titulo" style={{ fontSize: "1.5rem", margin: 0 }}>
          Hola{nombre ? `, ${nombre}` : ""}
        </h1>
        <span className="muted" style={{ fontSize: "0.8rem" }}>{campusActivo}</span>
      </div>

      {!!avisos?.total && (
        <div className="tarjeta" style={{ marginBottom: 20, borderColor: "var(--danger)" }}>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.75rem" }}>PENDIENTES</p>
          {avisos.encuentros.map((e) => (
            <p
              key={e.key}
              style={{ margin: "2px 0", fontSize: "0.85rem", cursor: "pointer" }}
              onClick={() => router.push(`/encuentros/${encodeURIComponent(e.key)}`)}
            >
              Falta finalizar {e.encuentro} del {e.fecha} · {e.campus}
            </p>
          ))}
          {avisos.notas.map((n) => (
            <p key={n.key} style={{ margin: "2px 0", fontSize: "0.85rem", cursor: "pointer" }} onClick={() => router.push("/equipos")}>
              Nota sin cerrar de {n.area} del {n.fecha} · {n.campus}
            </p>
          ))}
        </div>
      )}

      {miTurno && (
        <div
          className="tarjeta"
          style={{ marginBottom: 20, cursor: "pointer" }}
          onClick={() => router.push("/turnos")}
        >
          <p className="muted" style={{ margin: "0 0 2px", fontSize: "0.75rem" }}>ESTA SEMANA</p>
          <p style={{ margin: 0, fontWeight: 600 }}>Te toca turno en {miTurno.campus}</p>
        </div>
      )}

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
