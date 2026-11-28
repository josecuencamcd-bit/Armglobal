"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCampus } from "@/lib/campus-context";
import { esFin, puedeSoporte, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";
import { Icono } from "@/lib/iconos";
import { peso } from "@/lib/grafico-linea";

/** Reemplaza vInicio() de Code.gs. A pedido de José (27-11), Home quedó
 * reducido a lo informativo/accionable: saludo + cumpleaños del día (ícono
 * en la esquina), acceso a Merch, pendientes y el aviso de administración
 * semanal — Fondo, Mi equipo (estadísticas) y Administración se sacaron de
 * acá (quedan solo en la barra de abajo / "Más"), para no repetir accesos
 * en dos lugares distintos. */
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
type Cumple = { nombre: string; area: string; anos_iglesia: number | null; foto_url: string | null; hoy: boolean; faltan: number | null };

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}
type Proximo = { encuentro: string; fecha: string; hoy: boolean } | null;
type ProductoMerch = { id: string; nombre: string; precio: number; foto_url: string | null; fotos: string[] | null };

function mesTitulo(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "jueves 4 de diciembre" — para la tarjeta de Próximo encuentro. */
function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export default function InicioPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const { campusActivo } = useCampus();
  const [perfil, setPerfil] = useState<PerfilVisibilidad | null>(null);
  const [miAdministracion, setMiAdministracion] = useState<MiAdministracion | null | undefined>(undefined);
  const [avisos, setAvisos] = useState<Avisos | null>(null);
  const [proximo, setProximo] = useState<Proximo>(null);
  const [cumplesHoy, setCumplesHoy] = useState<Cumple[]>([]);
  const [proximoCumple, setProximoCumple] = useState<Cumple | null>(null);
  const [proximosCumples, setProximosCumples] = useState<Cumple[]>([]);
  const [productoMerch, setProductoMerch] = useState<ProductoMerch | null>(null);
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
    fetch("/api/proximo-encuentro").then((r) => r.json()).then((json) => { if (json.ok) setProximo(json.data); });
    // ?todo=1 trae todo el año ordenado por cercanía (lista[0] es el/la
    // próxima persona en cumplir, sea hoy o en N días) — José: "quién es
    // la siguiente persona" y, cuando llegue su día, que muestre a esa
    // persona cumpliendo hoy.
    fetch("/api/cumpleanos?todo=1").then((r) => r.json()).then((json) => {
      if (!json.ok) return;
      const lista = json.data.lista as Cumple[];
      setCumplesHoy(lista.filter((p) => p.hoy));
      setProximoCumple(lista[0] ?? null);
      // Tira horizontal "Próximos cumpleaños" (estilo referencia de José,
      // 28-nov) — los que faltan, sin repetir a quien ya sale en el banner
      // grande de "hoy".
      setProximosCumples(lista.filter((p) => !p.hoy).slice(0, 8));
    });
  }, []);

  useEffect(() => {
    if (!campusActivo) return;
    fetch(`/api/merch/productos?campus=${encodeURIComponent(campusActivo)}&activos=1`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) return;
        const productos = (json.data as ProductoMerch[]).filter((p) => p.foto_url || p.fotos?.length);
        if (!productos.length) { setProductoMerch(null); return; }
        // Rotación diaria (no aleatoria por render, para que no "salte" cada
        // vez que se recarga la pantalla el mismo día) — José: que la
        // tarjeta vaya promocionando distintos productos con el tiempo.
        const diaDelAno = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
        setProductoMerch(productos[diaDelAno % productos.length]);
      });
  }, [campusActivo]);

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
  const totalAvisos = (avisos?.encuentros.length ?? 0) + (avisos?.notas.length ?? 0) + (avisos?.cierres.length ?? 0) + (avisos?.autorizaciones ? 1 : 0);

  return (
    <div>
      {/* Banner curvo (José, 28-nov: "home estilo Talana, con nuestros
       * colores y la info que ya tenemos") — saludo + soporte/ayuda arriba,
       * y si alguien cumple hoy, el festejo grande acá mismo en vez de una
       * fila más abajo. */}
      <div className="home-banner">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="titulo" style={{ fontSize: "1.5rem", margin: 0, color: "var(--accent-ink)" }}>
              Hola{nombre ? `, ${nombre}` : ""}
            </h1>
            {mostrarCampus && (
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--accent-ink)", opacity: 0.75 }}>Campus {campusActivo}</p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {mostrarSoporte && (
              <button onClick={() => router.push("/soporte")} className="soporte-btn home-banner-btn">
                ⚙ Soporte
                {!!avisos?.autorizaciones && <span className="nb">{avisos.autorizaciones}</span>}
              </button>
            )}
            <button onClick={() => setAyudaAbierta((v) => !v)} className="ayuda-btn home-banner-btn">
              ? Ayuda
            </button>
          </div>
        </div>

        {cumplesHoy.length > 0 && (
          <button type="button" onClick={() => router.push("/cumpleanos")} className="home-birthday">
            <span className="home-birthday-ic">🎂</span>
            <div style={{ minWidth: 0 }}>
              <b>¡Feliz cumpleaños, {cumplesHoy[0].nombre.split(" ")[0]}!</b>
              <small style={{ display: "block" }}>
                Sirve en {cumplesHoy[0].area}
                {cumplesHoy.length > 1 ? ` · +${cumplesHoy.length - 1} más hoy` : ""} · Ver saludos →
              </small>
            </div>
          </button>
        )}
      </div>

      <div className="contenedor" style={{ paddingTop: 16, marginTop: -18 }}>
        {proximosCumples.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em" }}>🎁 PRÓXIMOS CUMPLEAÑOS</p>
            <div className="home-cumples-strip">
              {proximosCumples.map((c, i) => (
                <button key={i} type="button" onClick={() => router.push("/cumpleanos")} className="home-cumple-chip">
                  <span className="home-cumple-avatar">
                    {c.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      iniciales(c.nombre)
                    )}
                  </span>
                  <small>{c.nombre.split(" ")[0]}</small>
                  <small className="muted">{c.faltan === 1 ? "mañana" : `en ${c.faltan}d`}</small>
                </button>
              ))}
              <button type="button" onClick={() => router.push("/cumpleanos")} className="home-cumple-chip">
                <span className="home-cumple-avatar home-cumple-avatar-mas">Ver</span>
                <small>todos</small>
              </button>
            </div>
          </div>
        )}

        <div className="home-actions">
          <button type="button" onClick={() => router.push("/merch")} className="home-action-card home-action-gold">
            {productoMerch?.fotos?.[0] ?? productoMerch?.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productoMerch!.fotos?.[0] ?? productoMerch!.foto_url!} alt="" className="home-action-img" />
            ) : (
              <span className="home-action-emoji">🛍️</span>
            )}
            <b>{productoMerch ? productoMerch.nombre : "Catálogo Merch"}</b>
            <small>{productoMerch ? peso(productoMerch.precio) : "Mira qué hay disponible"}</small>
          </button>

          <button
            type="button"
            onClick={() => router.push(proximo ? "/encuentros" : "/merch")}
            className="home-action-card home-action-dark"
            disabled={!proximo}
          >
            <span className="home-action-emoji">📅</span>
            <b>Próximo encuentro</b>
            <small>{proximo ? `${proximo.encuentro} · ${proximo.hoy ? "Hoy" : fechaLarga(proximo.fecha)}` : "Nada agendado"}</small>
          </button>
        </div>

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
    </div>
  );
}
