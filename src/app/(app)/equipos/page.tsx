"use client";

import { useEffect, useState, useCallback } from "react";
import { AREAS } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";
import { VolverAdministracion } from "@/lib/volver-admin";

type Integrante = {
  id: number;
  campus: string;
  area: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  estado: string;
  nacimiento: string | null;
  anos_iglesia: number | null;
  anos_servicio: number | null;
  rol_servicio: string | null;
  profesion: string | null;
};

/** Días que faltan para el próximo cumpleaños (0 = hoy), igual criterio
 * que /api/cumpleanos pero acotado a la lista ya cargada de esta área. */
function diasHastaCumple(nacimiento: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) return null;
  const [, , mesStr, diaStr] = m;
  const hoy = new Date();
  const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let d = Date.UTC(hoy.getFullYear(), +mesStr - 1, +diaStr);
  if (d < base) d = Date.UTC(hoy.getFullYear() + 1, +mesStr - 1, +diaStr);
  return Math.round((d - base) / 86_400_000);
}

function promedio(valores: (number | null)[]): number | null {
  const nums = valores.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

type SolicitudBaja = { id: number; integrante_id: number | null; estado: string };

type Ficha = {
  id: number;
  servicio: string;
  tipo: string;
  area: string;
  fecha: string;
  puesto: string;
  nombre: string | null;
  encargado: string | null;
};

/** Equivalente a FICHA_HOJAS/FICHA_AREAS de Code.gs: antes se sincronizaba
 * sola desde una hoja de cálculo externa (Ficha) cada hora; acá el líder la
 * carga a mano desde "Mi equipo" (api_fichaActualizar → /api/fichas-servicio). */
const SERVICIOS = ["Jueves 8pm", "Domingo 11am", "Domingo 6pm"] as const;
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Módulo Equipos (= "Mi equipo"/integrantes) — equivalente a api_ecoEquipo*
 * de la app vieja, contra /api/integrantes(/[id]), ya existentes. */
export default function EquiposPage() {
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const [area, setArea] = useState<(typeof AREAS)[number]>(AREAS[0]);
  const [lista, setLista] = useState<Integrante[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<Integrante | null>(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [bajasPendientes, setBajasPendientes] = useState<Set<number>>(new Set());
  const [pidiendoBaja, setPidiendoBaja] = useState<number | null>(null);
  const [enviandoBaja, setEnviandoBaja] = useState(false);

  const [servicio, setServicio] = useState<(typeof SERVICIOS)[number]>(SERVICIOS[0]);
  const [fechaFicha, setFechaFicha] = useState(hoyISO());
  const [ficha, setFicha] = useState<Ficha[] | null>(null);
  const [mostrarFormFicha, setMostrarFormFicha] = useState(false);
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  const cargar = useCallback(async (c: string, a: string) => {
    const [res, resBajas] = await Promise.all([
      fetch(`/api/integrantes?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`),
      fetch(`/api/integrantes/solicitudes-baja?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`),
    ]);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
    const jsonBajas = await resBajas.json();
    if (jsonBajas.ok) {
      setBajasPendientes(new Set(
        (jsonBajas.data as SolicitudBaja[])
          .filter((s) => s.estado === "Pendiente" && s.integrante_id != null)
          .map((s) => s.integrante_id as number)
      ));
    }
  }, []);

  const cargarFicha = useCallback(async (a: string, serv: string, f: string) => {
    const res = await fetch(
      `/api/fichas-servicio?servicio=${encodeURIComponent(serv)}&tipo=${encodeURIComponent(a)}&fecha=${encodeURIComponent(f)}`
    );
    const json = await res.json();
    if (!json.ok) return;
    setFicha(json.data.filter((x: Ficha) => x.area === a));
  }, []);

  useEffect(() => {
    cargar(campus, area);
  }, [campus, area, cargar]);

  useEffect(() => {
    cargarFicha(area, servicio, fechaFicha);
  }, [area, servicio, fechaFicha, cargarFicha]);

  async function crearFicha(fd: FormData) {
    setGuardandoFicha(true);
    const res = await fetch("/api/fichas-servicio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        servicio,
        tipo: area,
        area,
        fecha: fechaFicha,
        puesto: fd.get("puesto"),
        nombre: fd.get("nombre") || undefined,
        encargado: fd.get("encargado") || undefined,
      }),
    });
    const json = await res.json();
    setGuardandoFicha(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarFormFicha(false);
    await cargarFicha(area, servicio, fechaFicha);
  }

  async function editarNombreFicha(id: number, nombre: string) {
    const res = await fetch(`/api/fichas-servicio/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargarFicha(area, servicio, fechaFicha);
  }

  async function crear(fd: FormData) {
    setGuardando(true);
    const res = await fetch("/api/integrantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        area,
        nombre: fd.get("nombre"),
        telefono: fd.get("telefono") || undefined,
        correo: fd.get("correo") || undefined,
        nacimiento: fd.get("nacimiento") || undefined,
        anos_iglesia: fd.get("anos_iglesia") ? Number(fd.get("anos_iglesia")) : undefined,
        anos_servicio: fd.get("anos_servicio") ? Number(fd.get("anos_servicio")) : undefined,
        rol_servicio: fd.get("rol_servicio") || undefined,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    await cargar(campus, area);
  }

  async function guardarEdicion(fd: FormData) {
    if (!editando) return;
    setGuardandoEdit(true);
    const res = await fetch(`/api/integrantes/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: fd.get("nombre"),
        telefono: fd.get("telefono") || undefined,
        correo: fd.get("correo") || undefined,
        area: fd.get("area"),
        nacimiento: fd.get("nacimiento") || undefined,
        anos_iglesia: fd.get("anos_iglesia") ? Number(fd.get("anos_iglesia")) : undefined,
        anos_servicio: fd.get("anos_servicio") ? Number(fd.get("anos_servicio")) : undefined,
        rol_servicio: fd.get("rol_servicio") || undefined,
      }),
    });
    const json = await res.json();
    setGuardandoEdit(false);
    if (!json.ok) { setError(json.error); return; }
    setEditando(null);
    await cargar(campus, area);
  }

  /** api_ecoSolBaja: un líder NUNCA da de baja directo — pide la baja con
   * motivo y el Administrador la aprueba desde /bajas (vSolicitudes de la
   * app vieja). Antes acá se llamaba DELETE /api/integrantes/[id] directo,
   * saltándose por completo esa aprobación. */
  async function solicitarBaja(i: Integrante, motivo: string) {
    if (!motivo.trim()) { setError("Falta el motivo de la baja."); return; }
    setEnviandoBaja(true);
    const res = await fetch("/api/integrantes/solicitudes-baja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrante_id: i.id, campus: i.campus, area: i.area, nombre: i.nombre, motivo }),
    });
    const json = await res.json();
    setEnviandoBaja(false);
    if (!json.ok) { setError(json.error); return; }
    setPidiendoBaja(null);
    await cargar(campus, area);
  }

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

  const activos = lista?.filter((i) => i.estado === "Activo") ?? [];
  const promIglesia = promedio(activos.map((i) => i.anos_iglesia));
  const promServicio = promedio(activos.map((i) => i.anos_servicio));
  const proximosCumples = activos
    .map((i) => ({ i, dias: i.nacimiento ? diasHastaCumple(i.nacimiento) : null }))
    .filter((x): x is { i: Integrante; dias: number } => x.dias != null)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);
  const porRol = new Map<string, Integrante[]>();
  for (const i of activos) {
    const rol = i.rol_servicio?.trim() || "Sin asignar";
    porRol.set(rol, [...(porRol.get(rol) ?? []), i]);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Equipos</h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campus}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>
      {error && <p className="aviso">{error}</p>}

      <div className="campo">
        <label>Área</label>
        <select value={area} onChange={(e) => setArea(e.target.value as (typeof AREAS)[number])}>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="eco-cards" style={{ marginBottom: 16 }}>
        <div className="eco-card"><span>Integrantes</span><b>{activos.length}</b></div>
        <div className="eco-card"><span>Años en la iglesia (prom.)</span><b>{promIglesia ?? "—"}</b></div>
        <div className="eco-card"><span>Años sirviendo (prom.)</span><b>{promServicio ?? "—"}</b></div>
      </div>

      {proximosCumples.length > 0 && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>CUMPLEAÑOS PRÓXIMOS</p>
          {proximosCumples.map(({ i, dias }) => (
            <p key={i.id} style={{ margin: "4px 0", fontSize: "0.85rem" }}>
              {i.nombre} <span className="muted">· {dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}</span>
            </p>
          ))}
        </div>
      )}

      {porRol.size > 0 && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>QUÉ HACE CADA UNO</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...porRol.entries()].map(([rol, personas]) => (
              <span
                key={rol}
                title={personas.map((p) => p.nombre).join(", ")}
                style={{
                  background: "var(--glass-2)", border: "1px solid var(--hud-line)", borderRadius: 999,
                  fontSize: "0.78rem", padding: "5px 10px", fontWeight: 600,
                }}
              >
                {rol} · {personas.length}
              </span>
            ))}
          </div>
        </div>
      )}

      <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
        {mostrarForm ? "Cerrar" : "Agregar integrante"}
      </button>

      {mostrarForm && (
        <form className="tarjeta" action={(fd) => crear(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="campo">
            <label>Nombre</label>
            <input name="nombre" required />
          </div>
          <div className="campo">
            <label>Teléfono</label>
            <input name="telefono" />
          </div>
          <div className="campo">
            <label>Correo</label>
            <input name="correo" type="email" />
          </div>
          <div className="campo">
            <label>Fecha de nacimiento (opcional)</label>
            <input name="nacimiento" type="date" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Años en la iglesia</label>
              <input name="anos_iglesia" type="number" min={0} max={120} />
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Años sirviendo</label>
              <input name="anos_servicio" type="number" min={0} max={120} />
            </div>
          </div>
          <div className="campo">
            <label>Qué hace / rol de servicio (opcional)</label>
            <input name="rol_servicio" placeholder="Ej: Sonido, Cámaras, Bienvenida…" />
          </div>
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}

      {lista?.filter((i) => i.estado === "Activo").length === 0 && (
        <p className="muted">Sin integrantes activos en {area} · {campus}.</p>
      )}
      {lista?.filter((i) => i.estado === "Activo").map((i) => {
        const sub = [
          i.profesion,
          i.rol_servicio,
          `${i.anos_servicio ?? 0} ${i.anos_servicio === 1 ? "año" : "años"} sirviendo`,
          `${i.anos_iglesia ?? 0} ${i.anos_iglesia === 1 ? "año" : "años"} en la iglesia`,
        ].filter(Boolean).join(" · ");
        return (
        <div key={i.id}>
          <div className="fila">
            <div>
              <div>{i.nombre}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{sub}</div>
              {(i.telefono || i.correo) && <div className="muted" style={{ fontSize: "0.76rem" }}>{i.telefono || i.correo}</div>}
            </div>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="boton-secundario" onClick={() => setEditando(editando?.id === i.id ? null : i)}>
                {editando?.id === i.id ? "Cerrar" : "Editar"}
              </button>
              {!bajasPendientes.has(i.id) && (
                <button className="boton-peligro" onClick={() => setPidiendoBaja(pidiendoBaja === i.id ? null : i.id)}>
                  Solicitar baja
                </button>
              )}
            </span>
          </div>
          {bajasPendientes.has(i.id) && (
            <p className="muted" style={{ fontSize: "0.78rem", margin: "-6px 0 10px" }}>
              Solicitud de baja pendiente de aprobación.
            </p>
          )}
          {pidiendoBaja === i.id && (
            <form
              className="tarjeta"
              style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}
              action={(fd) => solicitarBaja(i, String(fd.get("motivo") ?? ""))}
            >
              <div className="campo">
                <label>Motivo de la baja</label>
                <input name="motivo" required autoFocus />
              </div>
              <button className="boton-peligro" type="submit" disabled={enviandoBaja}>
                {enviandoBaja ? "Enviando…" : "Enviar solicitud"}
              </button>
            </form>
          )}
          {editando?.id === i.id && (
            <form className="tarjeta" action={(fd) => guardarEdicion(fd)} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              <div className="campo">
                <label>Nombre</label>
                <input name="nombre" defaultValue={i.nombre} required />
              </div>
              <div className="campo">
                <label>Teléfono</label>
                <input name="telefono" defaultValue={i.telefono ?? ""} />
              </div>
              <div className="campo">
                <label>Correo</label>
                <input name="correo" type="email" defaultValue={i.correo ?? ""} />
              </div>
              <div className="campo">
                <label>Área</label>
                <select name="area" defaultValue={i.area}>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="campo">
                <label>Fecha de nacimiento (opcional)</label>
                <input name="nacimiento" type="date" defaultValue={i.nacimiento ?? ""} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Años en la iglesia</label>
                  <input name="anos_iglesia" type="number" min={0} max={120} defaultValue={i.anos_iglesia ?? ""} />
                </div>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Años sirviendo</label>
                  <input name="anos_servicio" type="number" min={0} max={120} defaultValue={i.anos_servicio ?? ""} />
                </div>
              </div>
              <div className="campo">
                <label>Qué hace / rol de servicio (opcional)</label>
                <input name="rol_servicio" defaultValue={i.rol_servicio ?? ""} placeholder="Ej: Sonido, Cámaras, Bienvenida…" />
              </div>
              <button className="boton" type="submit" disabled={guardandoEdit}>
                {guardandoEdit ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
          )}
        </div>
        );
      })}

      <h2 className="titulo" style={{ fontSize: "1.05rem", marginTop: 28 }}>Ficha de servicio</h2>
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: -8 }}>
        Quién sirve en {area} para un servicio y fecha puntual.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="campo" style={{ flex: 1, minWidth: 160 }}>
          <label>Servicio</label>
          <select value={servicio} onChange={(e) => setServicio(e.target.value as (typeof SERVICIOS)[number])}>
            {SERVICIOS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 140 }}>
          <label>Fecha</label>
          <input type="date" value={fechaFicha} onChange={(e) => setFechaFicha(e.target.value)} />
        </div>
      </div>

      <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarFormFicha((v) => !v)}>
        {mostrarFormFicha ? "Cerrar" : "Agregar puesto"}
      </button>

      {mostrarFormFicha && (
        <form className="tarjeta" action={(fd) => crearFicha(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="campo">
            <label>Puesto</label>
            <input name="puesto" required />
          </div>
          <div className="campo">
            <label>Nombre</label>
            <input name="nombre" />
          </div>
          <div className="campo">
            <label>Encargado</label>
            <input name="encargado" />
          </div>
          <button className="boton" type="submit" disabled={guardandoFicha}>
            {guardandoFicha ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}

      {ficha?.length === 0 && (
        <p className="muted">Sin puestos cargados para {servicio} · {fechaFicha}.</p>
      )}
      {ficha?.map((f) => (
        <div className="fila" key={f.id}>
          <div>
            <div>{f.puesto}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>{f.encargado || ""}</div>
          </div>
          <input
            defaultValue={f.nombre ?? ""}
            placeholder="Nombre"
            style={{ maxWidth: 160 }}
            onBlur={(e) => {
              if (e.target.value !== (f.nombre ?? "")) editarNombreFicha(f.id, e.target.value);
            }}
          />
        </div>
      ))}
    </div>
  );
}
