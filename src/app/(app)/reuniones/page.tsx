"use client";

import { useEffect, useState, useCallback } from "react";

type Reunion = {
  id: number;
  tipo: string;
  fecha: string;
  hora: string | null;
  titulo: string | null;
  lugar: string | null;
  invitados: string | null;
  notas: string | null;
  estado: string;
};

type Persona = { correo: string; nombre: string; campus: string | null; roles: string[] | null };

const TIPOS = ["Reunión de equipo", "Reunión 1 a 1", "Café"] as const;
const DURACIONES = [[30, "30 min"], [45, "45 min"], [60, "1 hora"], [90, "1 h 30"], [120, "2 horas"]] as const;
const PLACEHOLDER_TITULO: Record<(typeof TIPOS)[number], string> = {
  "Café": "Ej.: Café para conversar",
  "Reunión 1 a 1": "Ej.: Seguimiento",
  "Reunión de equipo": "Ej.: Planificación del mes",
};

/** Módulo Reuniones: agenda interna del usuario — equivalente a api_reuLista
 * / api_reuCrear / api_reuCancelar / api_reuDirectorio, ya existentes.
 * Tipo (Equipo/1 a 1/Café) + buscador de personas con chips, igual que
 * vReuniones() de Code.gs (sin el envío de invitación por correo, que acá
 * no tiene equivalente). */
export default function ReunionesPage() {
  const [lista, setLista] = useState<Reunion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>(TIPOS[1]);
  const [directorio, setDirectorio] = useState<Persona[] | null>(null);
  const [busca, setBusca] = useState("");
  const [seleccion, setSeleccion] = useState<Persona[]>([]);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/reuniones");
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
  }, []);

  useEffect(() => {
    cargar();
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
    setSeleccion((s) => (s.some((x) => x.correo === p.correo) ? s : [...s, p]));
    setBusca("");
  }
  function quitarPersona(correo: string) {
    setSeleccion((s) => s.filter((x) => x.correo !== correo));
  }

  const resultados = (directorio ?? [])
    .filter((p) => !seleccion.some((s) => s.correo === p.correo))
    .filter((p) => !busca.trim() || (p.nombre + " " + (p.campus ?? "")).toLowerCase().includes(busca.trim().toLowerCase()))
    .slice(0, busca.trim() ? 8 : 5);

  async function crear(fd: FormData) {
    setGuardando(true);
    const invitados = seleccion.map((p) => `${p.nombre} <${p.correo}>`).join(", ") || undefined;
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
        invitados,
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

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

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
            <input name="hora" type="time" defaultValue="19:00" />
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
            {seleccion.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {seleccion.map((p) => (
                  <button
                    key={p.correo}
                    type="button"
                    className="boton-secundario"
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                    onClick={() => quitarPersona(p.correo)}
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
                key={p.correo}
                type="button"
                className="fila"
                style={{ width: "100%", textAlign: "left", background: "none", cursor: "pointer" }}
                onClick={() => agregarPersona(p)}
              >
                <span>{p.nombre}</span>
                <span className="muted" style={{ fontSize: "0.75rem" }}>{(p.roles ?? []).join(", ") || p.campus || ""}</span>
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

      {lista?.length === 0 && <p className="muted">No tienes reuniones agendadas.</p>}
      {lista?.map((r) => (
        <div className="tarjeta" key={r.id}>
          <div className="fila" style={{ border: 0, padding: 0 }}>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>{r.titulo || r.tipo}</p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                {r.fecha}{r.hora ? ` · ${r.hora}` : ""}{r.lugar ? ` · ${r.lugar}` : ""}
                {r.estado === "Cancelada" && <span style={{ color: "var(--danger)" }}> · Cancelada</span>}
              </p>
            </div>
            {r.estado !== "Cancelada" && (
              <button className="boton-peligro" onClick={() => cancelar(r.id)}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
