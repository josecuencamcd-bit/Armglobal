"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { Icono } from "@/lib/iconos";
import { useCampus } from "@/lib/campus-context";
import {
  modulosVisibles,
  CLAVE_A_MODULO_APP,
  esFin,
  puedeSoporte,
  puedeVerEquipo,
  type PerfilVisibilidad,
} from "@/lib/visibilidad-modulos";
import { GraficoLinea, peso } from "@/lib/grafico-linea";

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

const TIPOS_AYUDA = ["Algo no funciona", "No entiendo cómo usarlo", "Falta un dato", "Otro"];

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
  cierres: { campus: string; area: string; mes: string }[];
  autorizaciones: number;
  total: number;
};
type Resumen = { campus: string; historico: number; cuenta: number; mesActual: number; pct: number; tendencia: { mes: string; monto: number }[] };
type ResumenLider = {
  area: string;
  campus: string;
  saldo: number;
  ultimo: { tipo: string; monto: number; fecha: string } | null;
  proximo: { encuentro: string; fecha: string; hoy: boolean } | null;
  tendencia: { mes: string; monto: number }[];
};
type EquipoStats = { area: string; dias: number; pct: number | null; servicios: number; sinServir: number; personas: { nombre: string; pct: number | null }[] };
type Cumple = { nombre: string; hoy?: boolean };

function mesTitulo(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function InicioPage() {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState("");
  const { campusActivo } = useCampus();
  const [perfil, setPerfil] = useState<PerfilVisibilidad | null>(null);
  const [miTurno, setMiTurno] = useState<MiTurno | null | undefined>(undefined);
  const [avisos, setAvisos] = useState<Avisos | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [resumenLider, setResumenLider] = useState<ResumenLider | null>(null);
  const [equipo, setEquipo] = useState<EquipoStats | null>(null);
  const [cumplesHoy, setCumplesHoy] = useState<Cumple[]>([]);
  const [visibles, setVisibles] = useState<Set<string> | null>(null);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [ayudaTipo, setAyudaTipo] = useState(TIPOS_AYUDA[0]);
  const [ayudaMensaje, setAyudaMensaje] = useState("");
  const [ayudaEnviando, setAyudaEnviando] = useState(false);
  const [ayudaOk, setAyudaOk] = useState(false);

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
      setPerfil(data as unknown as PerfilVisibilidad);
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
    fetch("/api/avisos").then((r) => r.json()).then((json) => { if (json.ok) setAvisos(json.data); });
    fetch("/api/fondos/resumen").then((r) => r.json()).then((json) => { if (json.ok) setResumen(json.data); });
    fetch("/api/fondos/resumen-lider").then((r) => r.json()).then((json) => { if (json.ok) setResumenLider(json.data); });
    fetch("/api/integrantes/stats?dias=30").then((r) => r.json()).then((json) => { if (json.ok) setEquipo(json.data); });
    fetch("/api/cumpleanos").then((r) => r.json()).then((json) => {
      if (json.ok) setCumplesHoy((json.data.lista as Cumple[]).filter((p) => p.hoy));
    });
  }, []);

  async function enviarAyuda() {
    if (!ayudaMensaje.trim()) return;
    setAyudaEnviando(true);
    try {
      const res = await fetch("/api/ayuda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: ayudaTipo, mensaje: ayudaMensaje.trim().slice(0, 300) }),
      });
      const json = await res.json();
      if (json.ok) {
        setAyudaOk(true);
        setAyudaMensaje("");
        setTimeout(() => { setAyudaAbierta(false); setAyudaOk(false); }, 1600);
      }
    } finally {
      setAyudaEnviando(false);
    }
  }

  // Mismo filtro que el menú inferior (ver layout): un tile mapeado a un
  // módulo de la lista vieja solo se muestra si esta persona lo tiene
  // visible por rol o por lo que el Admin app haya ajustado en /perfiles.
  const modulosVisiblesAqui = MODULOS.filter((m) => {
    const claveVieja = CLAVE_A_MODULO_APP[m.key];
    if (!claveVieja || !visibles) return true;
    return visibles.has(claveVieja);
  });
  const porClave = new Map(modulosVisiblesAqui.map((m) => [m.key, m]));

  const mostrarCampus = perfil ? !esFin(perfil) : false;
  const mostrarSoporte = perfil ? puedeSoporte(perfil) : false;
  const mostrarEquipo = perfil ? puedeVerEquipo(perfil) : false;
  const totalAvisos = (avisos?.encuentros.length ?? 0) + (avisos?.notas.length ?? 0) + (avisos?.cierres.length ?? 0) + (avisos?.autorizaciones ? 1 : 0);

  return (
    <div className="contenedor" style={{ paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <h1 className="titulo" style={{ fontSize: "1.5rem", margin: 0 }}>
          Hola{nombre ? `, ${nombre}` : ""}
        </h1>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {mostrarSoporte && (
            <button
              onClick={() => router.push("/soporte")}
              className="boton-secundario"
              style={{ width: "auto", padding: "6px 10px", fontSize: "0.78rem", position: "relative" }}
            >
              ⚙ Soporte
              {!!avisos?.autorizaciones && (
                <span style={{ position: "absolute", top: -4, right: -4, background: "var(--danger)", color: "#fff", borderRadius: 999, fontSize: "0.6rem", padding: "1px 5px", fontWeight: 700 }}>
                  {avisos.autorizaciones}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setAyudaAbierta((v) => !v)} className="boton-secundario" style={{ width: "auto", padding: "6px 10px", fontSize: "0.78rem" }}>
            ? Ayuda
          </button>
        </div>
      </div>
      {mostrarCampus && (
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.8rem" }}>Campus {campusActivo}</p>
      )}
      {!mostrarCampus && <div style={{ marginBottom: 12 }} />}

      {ayudaAbierta && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          {ayudaOk ? (
            <p className="ok" style={{ margin: 0 }}>Mensaje enviado. Gracias por avisar.</p>
          ) : (
            <>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>CUÉNTANOS QUÉ PASA</p>
              <div className="campo">
                <select value={ayudaTipo} onChange={(e) => setAyudaTipo(e.target.value)}>
                  {TIPOS_AYUDA.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="campo">
                <textarea
                  rows={3}
                  maxLength={300}
                  value={ayudaMensaje}
                  onChange={(e) => setAyudaMensaje(e.target.value)}
                  placeholder="Cuéntanos con el mayor detalle posible…"
                />
              </div>
              <button className="boton" disabled={ayudaEnviando || !ayudaMensaje.trim()} onClick={enviarAyuda}>
                {ayudaEnviando ? "Enviando…" : "Enviar"}
              </button>
            </>
          )}
        </div>
      )}

      {resumen && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 2px", fontSize: "0.75rem" }}>INGRESOS TOTALES</p>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>Desde el inicio · Campus {resumen.campus}</p>
          <p className="num" style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700, color: "var(--accent-2)" }}>{peso(resumen.historico)}</p>
          <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.8rem" }}>{resumen.cuenta} registros en total</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ color: resumen.pct >= 0 ? "var(--ok)" : "var(--danger)", fontWeight: 700, fontSize: "0.85rem" }}>
              {resumen.pct >= 0 ? "▲" : "▼"} {Math.abs(resumen.pct)}%
            </span>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Este mes: {peso(resumen.mesActual)}</span>
          </div>
          <GraficoLinea datos={resumen.tendencia} />
        </div>
      )}

      {resumenLider && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 2px", fontSize: "0.75rem" }}>FONDO DE {resumenLider.area.toUpperCase()}</p>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>Saldo disponible</p>
          <p className="num" style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700, color: "var(--accent-2)" }}>{peso(resumenLider.saldo)}</p>
          <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.8rem" }}>
            {resumenLider.ultimo
              ? `Último ${resumenLider.ultimo.tipo}: ${peso(resumenLider.ultimo.monto)} · ${resumenLider.ultimo.fecha}`
              : "Aún no hay movimientos este mes"}
          </p>
          <GraficoLinea datos={resumenLider.tendencia} />
          {resumenLider.proximo && (
            <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.8rem" }}>
              {resumenLider.proximo.hoy ? "Hoy" : resumenLider.proximo.fecha} · Próximo encuentro: {resumenLider.proximo.encuentro}
            </p>
          )}
          <button className="boton-secundario" style={{ marginTop: 10 }} onClick={() => router.push("/fondos")}>Ver fondo</button>
        </div>
      )}

      {mostrarEquipo && equipo && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>
            TU EQUIPO · {equipo.area.toUpperCase()} · Últimos {equipo.dias} días
          </p>
          <div style={{ display: "flex", gap: 10, marginBottom: equipo.personas.length ? 10 : 0 }}>
            <div style={{ flex: 1 }}>
              <p className="num" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: (equipo.pct ?? 0) < 60 ? "var(--danger)" : "var(--ok)" }}>
                {equipo.pct ?? "—"}{equipo.pct != null ? "%" : ""}
              </p>
              <p className="muted" style={{ margin: 0, fontSize: "0.72rem" }}>Asistencia</p>
            </div>
            <div style={{ flex: 1 }}>
              <p className="num" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>{equipo.servicios}</p>
              <p className="muted" style={{ margin: 0, fontSize: "0.72rem" }}>Sirvieron</p>
            </div>
            <div style={{ flex: 1 }}>
              <p className="num" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: equipo.sinServir > 0 ? "var(--danger)" : "inherit" }}>{equipo.sinServir}</p>
              <p className="muted" style={{ margin: 0, fontSize: "0.72rem" }}>Sin servir</p>
            </div>
          </div>
          {equipo.personas.slice(0, 3).map((p) => (
            <p key={p.nombre} style={{ margin: "2px 0", fontSize: "0.82rem" }}>
              {p.nombre} <span className="muted">· {p.pct != null ? `${p.pct}% asistencia` : "—"}</span>
            </p>
          ))}
          <button className="boton-secundario" style={{ marginTop: 10 }} onClick={() => router.push("/estadisticas")}>Ver estadísticas del equipo</button>
        </div>
      )}

      {!!totalAvisos && (
        <div className="tarjeta" style={{ marginBottom: 16, borderColor: "var(--danger)" }}>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>PENDIENTES</p>
          {(avisos!.encuentros.length > 0 || avisos!.cierres.length > 0 || avisos!.autorizaciones > 0) && (
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              {avisos!.encuentros.length > 0 && (
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => router.push("/encuentros")}>
                  <p className="num" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{avisos!.encuentros.length}</p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.68rem" }}>Encuentros pendientes</p>
                </div>
              )}
              {avisos!.cierres.length > 0 && (
                <div style={{ flex: 1 }}>
                  <p className="num" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{avisos!.cierres.length}</p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.68rem" }}>Meses por cerrar</p>
                </div>
              )}
              {avisos!.autorizaciones > 0 && (
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => router.push("/soporte")}>
                  <p className="num" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{avisos!.autorizaciones}</p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.68rem" }}>Autorizaciones</p>
                </div>
              )}
            </div>
          )}
          {avisos!.encuentros.map((e) => (
            <p key={e.key} style={{ margin: "4px 0", fontSize: "0.85rem", cursor: "pointer" }} onClick={() => router.push(`/encuentros/${encodeURIComponent(e.key)}`)}>
              Hay un encuentro pendiente — {e.encuentro} · {e.campus} · {e.fecha} · falta finalizarlo
            </p>
          ))}
          {avisos!.notas.map((n) => (
            <p key={n.key} style={{ margin: "4px 0", fontSize: "0.85rem", cursor: "pointer" }} onClick={() => router.push("/equipos")}>
              Nota sin cerrar de {n.area} del {n.fecha} · {n.campus}
            </p>
          ))}
          {avisos!.cierres.map((c, i) => (
            <p
              key={i}
              style={{ margin: "4px 0", fontSize: "0.85rem", cursor: "pointer" }}
              onClick={() => router.push(c.area === "Campus" ? "/finanzas" : "/fondos")}
            >
              Falta cerrar el mes — {c.area === "Campus" ? "Finanzas del campus" : `Fondo de ${c.area}`} · {mesTitulo(c.mes)} · Campus {c.campus}
            </p>
          ))}
          {!!avisos!.autorizaciones && (
            <p style={{ margin: "4px 0", fontSize: "0.85rem", cursor: "pointer" }} onClick={() => router.push("/soporte")}>
              {avisos!.autorizaciones} autorización{avisos!.autorizaciones > 1 ? "es" : ""} de fondos esperan tu acción — toca para revisar
            </p>
          )}
        </div>
      )}

      {miTurno && (
        <div className="tarjeta" style={{ marginBottom: 16, cursor: "pointer" }} onClick={() => router.push("/turnos")}>
          <p className="muted" style={{ margin: "0 0 2px", fontSize: "0.75rem" }}>ESTA SEMANA SIRVES</p>
          <p style={{ margin: 0, fontWeight: 600 }}>Te toca turno en {miTurno.campus}</p>
        </div>
      )}

      {cumplesHoy.length > 0 && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            🎂 Hoy cumple{cumplesHoy.length > 1 ? "n" : ""} años {cumplesHoy.map((c) => c.nombre.split(" ")[0]).join(", ")}
          </p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>Un saludo hace la diferencia</p>
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
