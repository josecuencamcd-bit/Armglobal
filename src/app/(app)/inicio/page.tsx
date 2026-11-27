"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCampus } from "@/lib/campus-context";
import { esFin, esPastorC, puedeSoporte, puedeVerEquipo, tiene, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";
import { GraficoLinea, peso } from "@/lib/grafico-linea";
import { Icono } from "@/lib/iconos";

/** Reemplaza vInicio() de Code.gs: solo el panel (tarjetas de ingresos,
 * fondo, tu equipo, pendientes, administración semanal, cumpleaños) — la app vieja no tenía
 * una grilla de botones acá, la navegación es por la barra inferior
 * (Inicio + hasta 4 accesos según rol + "Más"). */
const TIPOS_AYUDA = ["Algo no funciona", "No entiendo cómo usarlo", "Falta un dato", "Otro"];

/** Lunes ISO de la semana que contiene `fecha` (mismo criterio que
 * lunesDe_ en Code.gs / administracion-semanal/page.tsx). */
function lunesDe(fecha: Date): string {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
}

type MiAdministracion = { semana: string; campus: string };
type Avisos = {
  encuentros: { campus: string; encuentro: string; fecha: string; key: string }[];
  notas: { campus: string; area: string; fecha: string; key: string }[];
  cierres: { campus: string; area: string; mes: string }[];
  autorizaciones: number;
  total: number;
};
type ResumenLider = {
  area: string;
  campus: string;
  saldo: number;
  ultimo: { tipo: string; monto: number; fecha: string } | null;
  proximo: { encuentro: string; fecha: string; hoy: boolean } | null;
  tendencia: { mes: string; monto: number }[];
};
type EquipoStats = { area: string; dias: number; pct: number | null; servicios: number; sinServir: number; personas: { nombre: string; pct: number | null }[] };
type Cumple = { nombre: string; area: string; anos_iglesia: number | null; foto_url: string | null; hoy?: boolean };

function mesTitulo(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function InicioPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const { campusActivo } = useCampus();
  const [perfil, setPerfil] = useState<PerfilVisibilidad | null>(null);
  const [miAdministracion, setMiAdministracion] = useState<MiAdministracion | null | undefined>(undefined);
  const [avisos, setAvisos] = useState<Avisos | null>(null);
  const [resumenLider, setResumenLider] = useState<ResumenLider | null>(null);
  const [equipo, setEquipo] = useState<EquipoStats | null>(null);
  const [cumplesHoy, setCumplesHoy] = useState<Cumple[]>([]);
  const [cumpleModalAbierto, setCumpleModalAbierto] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [ayudaTipo, setAyudaTipo] = useState(TIPOS_AYUDA[0]);
  const [ayudaMensaje, setAyudaMensaje] = useState("");
  const [ayudaEnviando, setAyudaEnviando] = useState(false);
  const [ayudaOk, setAyudaOk] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      // Antes esto leía directo de Supabase con el usuario REAL de la
      // sesión — si había una "vista como X" activa, Inicio decidía qué
      // tarjetas mostrar (Tu equipo, Administración, etc.) según quien
      // administra la vista, no según X. /api/perfil ya resuelve esto
      // (identidadActuante), igual que el resto de la app.
      const res = await fetch("/api/perfil");
      const json = await res.json();
      if (cancelado || !json.ok) return;
      setNombre(json.data.nombre.split(" ")[0]);
      setPerfil(json.data as unknown as PerfilVisibilidad);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const res = await fetch("/api/administracion-semanal/mias");
      const json = await res.json();
      if (cancelado) return;
      if (!json.ok) { setMiAdministracion(null); return; }
      const semanaActual = lunesDe(new Date());
      const match = (json.data as MiAdministracion[]).find((t) => t.semana === semanaActual && t.campus === campusActivo);
      setMiAdministracion(match ?? null);
    })();
    return () => {
      cancelado = true;
    };
  }, [campusActivo]);

  useEffect(() => {
    fetch("/api/avisos").then((r) => r.json()).then((json) => { if (json.ok) setAvisos(json.data); });
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
  // Acceso directo a Administración desde Inicio — no depende de la hoja
  // "Más" (su propio scroll venía fallando en algunos celulares). Mismo
  // criterio que modulosVisibles(): esPastorC() || Ministro || Administrador.
  const mostrarAdministracion = perfil ? (esPastorC(perfil) || tiene(perfil, "Ministro") || tiene(perfil, "Administrador")) : false;
  const totalAvisos = (avisos?.encuentros.length ?? 0) + (avisos?.notas.length ?? 0) + (avisos?.cierres.length ?? 0) + (avisos?.autorizaciones ? 1 : 0);

  return (
    <div className="contenedor" style={{ paddingTop: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <h1 className="titulo" style={{ fontSize: "1.5rem", margin: 0 }}>
          Hola{nombre ? `, ${nombre}` : ""}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {cumplesHoy.length > 0 && (
            <button
              type="button"
              className="cumple-corner"
              title={cumplesHoy.length === 1 ? `Hoy cumple ${cumplesHoy[0].nombre}` : `${cumplesHoy.length} cumpleaños hoy`}
              onClick={() => setCumpleModalAbierto(true)}
            >
              {cumplesHoy.length === 1 && cumplesHoy[0].foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cumplesHoy[0].foto_url} alt="" />
              ) : (
                "🎂"
              )}
              {cumplesHoy.length > 1 && <span className="conteo">{cumplesHoy.length}</span>}
            </button>
          )}
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

      {cumpleModalAbierto && (
        <div className="nav-sheet" onClick={() => setCumpleModalAbierto(false)}>
          <div className="nav-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="nav-sheet-head">
              <b>🎂 Cumpleaños de hoy</b>
              <button onClick={() => setCumpleModalAbierto(false)}>✕</button>
            </div>
            {cumplesHoy.map((c, idx) => (
              <div key={c.nombre + idx} className="cumple-modal-item">
                {c.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.foto_url} alt="" />
                ) : (
                  <span className="emoji">🎂</span>
                )}
                <div>
                  <b>¡Feliz cumpleaños, {c.nombre.split(" ")[0]}!</b>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>
                    Sirve en {c.area}{c.anos_iglesia != null ? ` · ${c.anos_iglesia} años en la iglesia` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {mostrarCampus && (
        <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.8rem" }}>Campus {campusActivo}</p>
      )}
      {!mostrarCampus && <div style={{ marginBottom: 12 }} />}

      {ayudaAbierta && (
        <div className="tarjeta" style={{ marginBottom: 12 }}>
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

      {resumenLider && (
        <div className="tarjeta hero-card" style={{ marginBottom: 12 }}>
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
        <div className="tarjeta" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>
            TU EQUIPO · {equipo.area.toUpperCase()} · Últimos {equipo.dias} días
          </p>
          <div className="eco-cards" style={{ marginBottom: equipo.personas.length ? 10 : 0 }}>
            <div className={`eco-card${(equipo.pct ?? 0) < 60 ? " warn" : " ok"}`}>
              <b>{equipo.pct == null ? "–" : `${equipo.pct}%`}</b>
              <span>Asistencia</span>
            </div>
            <div className="eco-card">
              <b>{equipo.servicios}</b>
              <span>Sirvieron</span>
            </div>
            <div className={`eco-card${equipo.sinServir ? " warn" : ""}`}>
              <b>{equipo.sinServir}</b>
              <span>Sin servir</span>
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

      {mostrarAdministracion && (
        <button
          type="button"
          onClick={() => router.push("/administracion")}
          className="tarjeta"
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "12px 16px", marginBottom: 12, cursor: "pointer", textAlign: "left",
            background: "var(--gold-grad)", color: "#1a1203", border: "none",
          }}
        >
          <Icono id="administracion" size={20} />
          <span style={{ fontWeight: 700, flex: 1 }}>Administración</span>
          <span>›</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => router.push("/merch")}
        className="tarjeta eco-row"
        style={{ width: "100%", cursor: "pointer", textAlign: "left", border: "none" }}
      >
        <div>
          <b>🛍️ Catálogo Merch</b>
          <small className="muted" style={{ display: "block" }}>Mira qué hay disponible y pide comprar</small>
        </div>
        <span className="muted">Ver →</span>
      </button>

      {!!totalAvisos && (
        <div className="tarjeta" style={{ marginBottom: 12, borderColor: "var(--danger)" }}>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>PENDIENTES</p>
          {(avisos!.encuentros.length > 0 || avisos!.cierres.length > 0 || avisos!.autorizaciones > 0) && (
            <div className="eco-cards" style={{ marginBottom: 10 }}>
              {avisos!.encuentros.length > 0 && (
                <button type="button" className="eco-card warn kpi-click" onClick={() => router.push("/encuentros")}>
                  <b>{avisos!.encuentros.length}</b>
                  <span>📋 Encuentros pendientes</span>
                </button>
              )}
              {avisos!.cierres.length > 0 && (
                <div className="eco-card warn">
                  <b>{avisos!.cierres.length}</b>
                  <span>🔒 Meses por cerrar</span>
                </div>
              )}
              {avisos!.autorizaciones > 0 && (
                <button type="button" className="eco-card warn kpi-click" onClick={() => router.push("/soporte")}>
                  <b>{avisos!.autorizaciones}</b>
                  <span>✍️ Autorizaciones</span>
                </button>
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

      {miAdministracion && (
        <div className="sirves" style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => router.push("/administracion-semanal")}>
          <span className="ic"><Icono id="asistencia" size={20} /></span>
          <div>
            <b>Esta semana administras</b>
            <span>Te toca administrar en {miAdministracion.campus}</span>
          </div>
        </div>
      )}

    </div>
  );
}
