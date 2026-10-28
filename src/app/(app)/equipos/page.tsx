"use client";

import { useEffect, useState, useCallback } from "react";
import { AREAS } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";

type Integrante = {
  id: number;
  campus: string;
  area: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  estado: string;
};

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

  const [servicio, setServicio] = useState<(typeof SERVICIOS)[number]>(SERVICIOS[0]);
  const [fechaFicha, setFechaFicha] = useState(hoyISO());
  const [ficha, setFicha] = useState<Ficha[] | null>(null);
  const [mostrarFormFicha, setMostrarFormFicha] = useState(false);
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  const cargar = useCallback(async (c: string, a: string) => {
    const res = await fetch(`/api/integrantes?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
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
      }),
    });
    const json = await res.json();
    setGuardandoEdit(false);
    if (!json.ok) { setError(json.error); return; }
    setEditando(null);
    await cargar(campus, area);
  }

  async function darDeBaja(id: number) {
    if (!confirm("¿Marcar como inactivo?")) return;
    const res = await fetch(`/api/integrantes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar(campus, area);
  }

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
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
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}

      {lista?.filter((i) => i.estado === "Activo").length === 0 && (
        <p className="muted">Sin integrantes activos en {area} · {campus}.</p>
      )}
      {lista?.filter((i) => i.estado === "Activo").map((i) => (
        <div key={i.id}>
          <div className="fila">
            <div>
              <div>{i.nombre}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{i.telefono || i.correo || ""}</div>
            </div>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="boton-secundario" onClick={() => setEditando(editando?.id === i.id ? null : i)}>
                {editando?.id === i.id ? "Cerrar" : "Editar"}
              </button>
              <button className="boton-peligro" onClick={() => darDeBaja(i.id)}>
                Dar de baja
              </button>
            </span>
          </div>
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
              <button className="boton" type="submit" disabled={guardandoEdit}>
                {guardandoEdit ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
          )}
        </div>
      ))}

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
