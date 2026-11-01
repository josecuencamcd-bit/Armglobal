"use client";

import { useEffect, useState, useCallback } from "react";

type ReunionFila = {
  id: number;
  tipo: string;
  titulo: string | null;
  fecha: string;
  hora: string | null;
  duracion: number;
  lugar: string | null;
  notas: string | null;
  organizador: string;
  mia: boolean;
  invitados: string[];
  cancelada: boolean;
  pasada: boolean;
};
type ConQuien = { nombre: string; veces: number; ultima: string };
type Datos = { hoy: string; proximas: ReunionFila[]; historial: ReunionFila[]; conQuien: ConQuien[]; tipos: string[] };
type Persona = { id: string; nombre: string; correo: string | null; area: string; perfil: string; campus: string | null };

const TIPOS = ["Reunión de equipo", "Reunión 1 a 1", "Café"] as const;
const DURACIONES = [[30, "30 min"], [45, "45 min"], [60, "1 hora"], [90, "1 h 30"], [120, "2 horas"]] as const;
const PLACEHOLDER_TITULO: Record<(typeof TIPOS)[number], string> = {
  "Café": "Ej.: Café para conversar",
  "Reunión 1 a 1": "Ej.: Seguimiento",
  "Reunión de equipo": "Ej.: Planificación del mes",
};

/** Módulo Reuniones — equivalente a api_reuLista / api_reuCrear /
 * api_reuCancelar / api_reuDirectorio: agenda de todos los perfiles e
 * integrantes (equipo, 1 a 1, café). Antes la pantalla solo mostraba la
 * lista plana de reuniones propias con un texto libre de invitados; ahora
 * trae próximas/historial/"con quién me he reunido" (últimos 90 días) y un
 * directorio real que resuelve ids en el servidor, igual que vReuniones(). */
export default function ReunionesPage() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>(TIPOS[1]);
  const [directorio, setDirectorio] = useState<Persona[] | null>(null);
  const [busca, setBusca] = useState("");
  const [seleccion, setSeleccion] = useState<Persona[]>([]);
  const [misAreas, setMisAreas] = useState<string[]>([]);
  const [esLider, setEsLider] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/reuniones");
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setDatos(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar();
    fetch("/api/perfil").then((r) => r.json()).then((json) => {
      if (!json.ok) return;
      const roles = (json.data.roles as string[] | null) ?? [];
      setEsLider(roles.includes("Líder"));
      setMisAreas((json.data.areas as string[] | null) ?? []);
    });
  }, [cargar]);

  function abrirForm() {
    const abrir = !mostrarForm;
    setMostrarForm(abrir);
    if (abrir && !directorio) {
      fetch("/api/reuniones/directorio").then((r) => r.json()).then((json) => {
        if (json.ok) setDirectorio(json.data);
      });
    }
  }

  function agregarPersona(p: Persona) {
    setSeleccion((s) => (s.some((x) => x.id === p.id) ? s : [...s, p]));
    setBusca("");
  }
  function quitarPersona(id: string) {
    setSeleccion((s) => s.filter((x) => x.id !== id));
  }
  function agregarTodoMiEquipo() {
    const mios = (directorio ?? []).filter((p) => misAreas.some((a) => (p.area || "").includes(a)));
    setSeleccion((s) => {
      const vistos = new Set(s.map((x) => x.id));
      return [...s, ...mios.filter((p) => !vistos.has(p.id))];
    });
  }

  const resultados = (directorio ?? [])
    .filter((p) => !seleccion.some((s) => s.id === p.id))
    .filter((p) => !busca.trim() || (p.nombre + " " + (p.campus ?? "")).toLowerCase().includes(busca.trim().toLowerCase()))
    .slice(0, busca.trim() ? 8 : 5);

  async function crear(fd: FormData) {
    setGuardando(true);
    const res = await fetch("/api/reuniones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        fecha: fd.get("fecha"),
        hora: fd.get("hora") || undefined,
        duracion: Number(fd.get("duracion")) || undefined,
        titulo: fd.get("titulo") || undefined,
        lugar: fd.get("lugar") || undefined,
        invitados: seleccion.map((p) => p.id),
        notas: fd.get("notas") || undefined,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    setSeleccion([]);
    await cargar();
  }

  async function cancelar(id: number) {
    if (!confirm("¿Cancelar esta reunión?")) return;
    const res = await fetch(`/api/reuniones/${id}/cancelar`, { method: "PATCH" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  if (!datos && !error) return <div className="contenedor">Cargando…</div>;

  function Tarjeta({ r }: { r: ReunionFila }) {
    return (
      <div className="tarjeta" key={r.id}>
        <div className="fila" style={{ border: 0, padding: 0 }}>
          <div>
            <p style={{ fontWeight: 600, margin: 0 }}>{r.titulo || r.tipo}</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
              {r.fecha}{r.hora ? ` · ${r.hora}` : ""}{r.lugar ? ` · ${r.lugar}` : ""}
              {r.cancelada && <span style={{ color: "var(--danger)" }}> · Cancelada</span>}
            </p>
            {r.invitados.length > 0 && (
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                {r.mia ? "Con: " : "Organiza: "}{r.mia ? r.invitados.join(", ") : r.organizador}
              </p>
            )}
          </div>
          {r.mia && !r.cancelada && (
            <button className="boton-peligro" onClick={() => cancelar(r.id)}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Reuniones</h1>
      {error && <p className="aviso">{error}</p>}

      <button className="boton" style={{ marginBottom: 16 }} onClick={abrirForm}>
        {mostrarForm ? "Cerrar" : "+ Agendar reunión o café"}
      </button>

      {mostrarForm && (
        <form
          className="tarjeta"
          action={(fd) => crear(fd)}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {TIPOS.map((t) => (
              <button
                key={t}
                type="button"
                className={t === tipo ? "boton" : "boton-secundario"}
                onClick={() => setTipo(t)}
                style={{ fontSize: "0.8rem", padding: "8px 4px" }}
              >
                {t === "Reunión de equipo" ? "Equipo" : t === "Reunión 1 a 1" ? "1 a 1" : "☕ Café"}
              </button>
            ))}
          </div>
          <div className="campo">
            <label>Título</label>
            <input name="titulo" placeholder={PLACEHOLDER_TITULO[tipo]} />
          </div>
          <div className="campo">
            <label>Fecha</label>
            <input name="fecha" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div className="campo">
            <label>Hora</label>
            <input name="hora" type="time" defaultValue="19:00" required />
          </div>
          <div className="campo">
            <label>Duración</label>
            <select name="duracion" defaultValue={60}>
              {DURACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Lugar</label>
            <input name="lugar" placeholder="Ej.: Café del centro, auditorio, Meet…" />
          </div>

          <div className="campo">
            <label>Con quién</label>
            {esLider && tipo === "Reunión de equipo" && (
              <button type="button" className="boton-secundario" style={{ fontSize: "0.78rem", marginBottom: 6 }} onClick={agregarTodoMiEquipo}>
                + Agregar a todo mi equipo
              </button>
            )}
            {seleccion.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {seleccion.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="boton-secundario"
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                    onClick={() => quitarPersona(p.id)}
                  >
                    {p.nombre} ✕
                  </button>
                ))}
              </div>
            )}
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar persona por nombre…" />
            {!directorio && <p className="muted" style={{ fontSize: "0.78rem" }}>Cargando personas…</p>}
            {directorio && resultados.length === 0 && (
              <p className="muted" style={{ fontSize: "0.78rem" }}>{busca.trim() ? "Nadie coincide con esa búsqueda." : ""}</p>
            )}
            {resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                className="fila"
                style={{ width: "100%", textAlign: "left", background: "none", cursor: "pointer" }}
                onClick={() => agregarPersona(p)}
              >
                <span>{p.nombre}</span>
                <span className="muted" style={{ fontSize: "0.75rem" }}>{p.perfil || p.area || p.campus || ""}</span>
              </button>
            ))}
          </div>

          <div className="campo">
            <label>Notas</label>
            <textarea name="notas" rows={3} maxLength={400} placeholder="Qué quieres conversar (opcional)" />
          </div>
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Agendar"}
          </button>
        </form>
      )}

      <h2 className="subtitulo" style={{ fontSize: "1rem", marginTop: 18 }}>Próximas</h2>
      {datos?.proximas.length === 0 && <p className="muted">No tienes reuniones agendadas.</p>}
      {datos?.proximas.map((r) => <Tarjeta key={r.id} r={r} />)}

      {datos && datos.conQuien.length > 0 && (
        <>
          <h2 className="subtitulo" style={{ fontSize: "1rem", marginTop: 18 }}>Con quién te has reunido (últimos 90 días)</h2>
          <div className="tarjeta">
            {datos.conQuien.map((c) => (
              <div className="fila" key={c.nombre}>
                <span>{c.nombre}</span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>{c.veces} {c.veces === 1 ? "vez" : "veces"} · última {c.ultima}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {datos && datos.historial.length > 0 && (
        <>
          <button className="boton-secundario" style={{ marginTop: 18, marginBottom: 8 }} onClick={() => setVerHistorial((v) => !v)}>
            {verHistorial ? "Ocultar historial" : `Ver historial (${datos.historial.length})`}
          </button>
          {verHistorial && datos.historial.map((r) => <Tarjeta key={r.id} r={r} />)}
        </>
      )}
    </div>
  );
}
