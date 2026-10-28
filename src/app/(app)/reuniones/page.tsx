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

/** Módulo Reuniones: agenda interna del usuario — equivalente a api_reuLista
 * / api_reuCrear / api_reuCancelar, ya existentes. */
export default function ReunionesPage() {
  const [lista, setLista] = useState<Reunion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

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

  async function crear(fd: FormData) {
    setGuardando(true);
    const res = await fetch("/api/reuniones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: fd.get("tipo"),
        fecha: fd.get("fecha"),
        hora: fd.get("hora") || undefined,
        titulo: fd.get("titulo") || undefined,
        lugar: fd.get("lugar") || undefined,
        invitados: fd.get("invitados") || undefined,
        notas: fd.get("notas") || undefined,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
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

      <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
        {mostrarForm ? "Cerrar" : "Nueva reunión"}
      </button>

      {mostrarForm && (
        <form
          className="tarjeta"
          action={(fd) => crear(fd)}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div className="campo">
            <label>Tipo</label>
            <input name="tipo" placeholder="1 a 1, café, directorio…" required />
          </div>
          <div className="campo">
            <label>Título</label>
            <input name="titulo" />
          </div>
          <div className="campo">
            <label>Fecha</label>
            <input name="fecha" type="date" required />
          </div>
          <div className="campo">
            <label>Hora</label>
            <input name="hora" type="time" />
          </div>
          <div className="campo">
            <label>Lugar</label>
            <input name="lugar" />
          </div>
          <div className="campo">
            <label>Invitados</label>
            <input name="invitados" placeholder="nombres o correos" />
          </div>
          <div className="campo">
            <label>Notas</label>
            <textarea name="notas" rows={3} />
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
