"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ASIS_IDS, VOL_IDS, CATEGORIAS, METODOS } from "@/lib/sesiones";

type Estado = {
  key: string;
  responsable: string;
  finalizado: boolean;
  sesion: Record<string, unknown> | null;
  asistencia: { area: string; cantidad: number }[];
  voluntarios: { area: string; cantidad: number }[];
  aportes: { id: string; nombre: string; monto: number; categoria: string; metodo: string }[];
};

/**
 * Pantalla de un encuentro: asistencia/voluntarios por área, aportes y
 * finalizar — equivalente a la vista principal del módulo Encuentros del
 * HTML embebido de Code.gs, ahora contra /api/sesiones/[key].
 */
export default function EncuentroPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;

  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/sesiones/${key}`);
    const json = await res.json();
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setEstado(json.data);
    setError(null);
  }, [key]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function setCampo(campo: string, valor: string | number) {
    setGuardando(true);
    const res = await fetch(`/api/sesiones/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campo, valor }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setEstado(json.data);
  }

  async function finalizar() {
    if (!confirm("¿Marcar este encuentro como finalizado?")) return;
    const res = await fetch(`/api/sesiones/${key}/finalizar`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setEstado(json.data);
  }

  async function agregarAporte(form: FormData) {
    const res = await fetch(`/api/sesiones/${key}/aportes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.get("nombre"),
        monto: Number(form.get("monto")),
        categoria: form.get("categoria"),
        metodo: form.get("metodo"),
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error);
      return;
    }
    await cargar();
  }

  async function borrarAporte(id: string) {
    if (!confirm("¿Eliminar este aporte?")) return;
    const res = await fetch(`/api/sesiones/${key}/aportes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error);
      return;
    }
    await cargar();
  }

  if (!estado && !error) return <div className="contenedor">Cargando…</div>;

  const [campus, encuentro, , fecha] = decodeURIComponent(key).split("|");

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.2rem" }}>
        {encuentro} · {campus}
      </h1>
      <p className="muted">{fecha}</p>
      {error && <p className="aviso">{error}</p>}

      {estado?.finalizado && <p className="aviso">Este encuentro está finalizado. Pide autorización para modificarlo.</p>}

      {estado && (
        <>
          <section className="tarjeta">
            <p className="titulo" style={{ fontSize: "1rem" }}>
              Asistencia
            </p>
            {ASIS_IDS.map((id) => {
              const fila = estado.asistencia.find((a) => a.area === id);
              return (
                <div className="campo" key={id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <label>{id}</label>
                  <input
                    type="number"
                    className="num"
                    style={{ width: 80 }}
                    defaultValue={fila?.cantidad ?? 0}
                    disabled={guardando || estado.finalizado}
                    onBlur={(e) => setCampo(`asis_${id}`, Number(e.target.value))}
                  />
                </div>
              );
            })}
          </section>

          <section className="tarjeta">
            <p className="titulo" style={{ fontSize: "1rem" }}>
              Voluntarios
            </p>
            {VOL_IDS.map((id) => {
              const fila = estado.voluntarios.find((v) => v.area === id);
              return (
                <div className="campo" key={id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <label>{id}</label>
                  <input
                    type="number"
                    className="num"
                    style={{ width: 80 }}
                    defaultValue={fila?.cantidad ?? 0}
                    disabled={guardando || estado.finalizado}
                    onBlur={(e) => setCampo(`vol_${id}`, Number(e.target.value))}
                  />
                </div>
              );
            })}
          </section>

          <section className="tarjeta">
            <p className="titulo" style={{ fontSize: "1rem" }}>
              Aportes
            </p>
            {estado.aportes.map((ap) => (
              <div className="fila" key={ap.id}>
                <span>
                  {ap.nombre} · {ap.categoria} · {ap.metodo}
                </span>
                <span className="num">
                  ${ap.monto.toLocaleString("es-CL")}{" "}
                  <button className="boton-peligro" type="button" onClick={() => borrarAporte(ap.id)} disabled={estado.finalizado}>
                    ✕
                  </button>
                </span>
              </div>
            ))}
            {!estado.finalizado && (
              <form
                action={(fd) => agregarAporte(fd)}
                style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}
              >
                <input name="nombre" placeholder="Nombre" required />
                <input name="monto" type="number" placeholder="Monto" required />
                <select name="categoria" defaultValue={CATEGORIAS[0]}>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select name="metodo" defaultValue={METODOS[0]}>
                  {METODOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button className="boton-secundario" type="submit">
                  Agregar aporte
                </button>
              </form>
            )}
          </section>

          {!estado.finalizado && (
            <button className="boton" onClick={finalizar}>
              Encuentro finalizado
            </button>
          )}
        </>
      )}
    </div>
  );
}
