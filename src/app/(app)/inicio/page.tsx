"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCampus } from "@/lib/campus-context";
import { esFin, puedeSoporte, puedeVerEquipo, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";
import { GraficoLinea, peso } from "@/lib/grafico-linea";
import { Icono } from "@/lib/iconos";

/** Reemplaza vInicio() de Code.gs: solo el panel (tarjetas de ingresos,
 * fondo, tu equipo, pendientes, turno, cumpleaños) — la app vieja no tenía
 * una grilla de botones acá, la navegación es por la barra inferior
 * (Inicio + hasta 4 accesos según rol + "Más"). */
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
            <button onClick={() => router.push("/soporte")} className="soporte-btn">
              ⚙ Soporte
              {!!avisos?.autorizaciones && <span className="nb">{avisos.autorizaciones}</span>}
            </button>
          )}
          <button onClick={() => setAyudaAbierta((v) => !v)} className="ayuda-btn">
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
        <div className="tarjeta hero-card" style={{ marginBottom: 16 }}>
          <div className="hero-tit">
            <span className="hero-ic"><Icono id="panorama" size={18} /></span>
            <div>
              <b>Ingresos totales</b>
              <small>Desde el inicio · Campus {resumen.campus}</small>
            </div>
          </div>
          <p className="hero-num">{peso(resumen.historico)}</p>
          <p className="eco-sub" style={{ margin: "0 0 2px" }}>{resumen.cuenta} registros en total</p>
          <div className={`hero-chip ${resumen.pct >= 0 ? "ok" : "bad"}`}>
            <b>{resumen.pct >= 0 ? "↗ +" : "↘ "}{Math.abs(resumen.pct)}%</b>
            <span>Este mes: {peso(resumen.mesActual)}</span>
          </div>
          <GraficoLinea datos={resumen.tendencia} />
        </div>
      )}

      {resumenLider && (
        <div className="tarjeta hero-card" style={{ marginBottom: 16 }}>
          <div className="hero-tit">
            <span className="hero-ic"><Icono id="fondo" size={18} /></span>
            <div>
              <b>Fondo de {resumenLider.area}</b>
              <small>Saldo disponible</small>
            </div>
          </div>
          <p className="hero-num">{peso(resumenLider.saldo)}</p>
          <p className="eco-sub">
            {resumenLider.ultimo
              ? `Último ${resumenLider.ultimo.tipo}: ${peso(resumenLider.ultimo.monto)} · ${resumenLider.ultimo.fecha}`
              : "Aún no hay movimientos este mes"}
          </p>
          <GraficoLinea datos={resumenLider.tendencia} />
          {resumenLider.proximo && (
            <div className="hero-chip">
              <b>{resumenLider.proximo.hoy ? "Hoy" : resumenLider.proximo.fecha}</b>
              <span>Próximo encuentro: {resumenLider.proximo.encuentro}</span>
            </div>
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
        <div className="sirves" style={{ marginBottom: 16, cursor: "pointer" }} onClick={() => router.push("/turnos")}>
          <span className="ic"><Icono id="asistencia" size={20} /></span>
          <div>
            <b>Esta semana sirves</b>
            <span>Te toca turno en {miTurno.campus}</span>
          </div>
        </div>
      )}

      {cumplesHoy.length > 0 && (
        <div className="cum-hoy" style={{ marginBottom: 16 }}>
          <span className="big">🎂</span>
          <div>
            <b>Hoy cumple{cumplesHoy.length > 1 ? "n" : ""} años {cumplesHoy.map((c) => c.nombre.split(" ")[0]).join(", ")}</b>
            <small>Un saludo hace la diferencia</small>
          </div>
        </div>
      )}

    </div>
  );
}
