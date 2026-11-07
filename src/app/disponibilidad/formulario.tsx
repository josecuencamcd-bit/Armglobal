"use client";

import { useEffect, useState } from "react";

type Integrante = { id: number; nombre: string };
type EncuentroSemana = { clave: string; fecha: string; etiqueta: string };
type Contexto = {
  campus: string[];
  areas: string[];
  semana: string;
  encuentros: EncuentroSemana[];
  abierta: boolean;
  mensajeCerrada: string;
};

const SIN_DISPONIBILIDAD = "Sin Disponibilidad";

/** Por ahora Puerto Natales todavía no tiene voluntarios propios — lo
 * cubren voluntarios de Punta Arenas que José Miguel asigna internamente
 * (pendiente: una pestaña de campus en el perfil del voluntario para eso).
 * Mientras tanto la encuesta pública es solo para Punta Arenas, con
 * disponibilidad abierta, sin pedir elegir campus. */
const CAMPUS_ENCUESTA = "Punta Arenas";

/**
 * Formulario público de disponibilidad — replica el formato de la encuesta
 * nativa de WhatsApp que el equipo ya usa ("Disponibilidad de servicio ✨",
 * opciones "Día DD/MM/AA hora [emoji]" + "Sin Disponibilidad 😟"), pero la
 * respuesta cae directo en `disponibilidad` vía /api/disponibilidad.
 *
 * Flujo: equipo → nombre (de la nómina real, no texto libre) →
 * disponibilidad de la semana → enviar.
 */
export default function DisponibilidadForm() {
  const [paso, setPaso] = useState<"area" | "nombre" | "disponibilidad" | "listo">("area");
  const campus = CAMPUS_ENCUESTA;
  const [area, setArea] = useState<string | null>(null);
  const [integrante, setIntegrante] = useState<Integrante | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [roster, setRoster] = useState<Integrante[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/disponibilidad/contexto?campus=${encodeURIComponent(campus)}`)
      .then((r) => r.json())
      .then((j) => j.ok && setContexto(j.data))
      .catch(() => {});
  }, [campus]);

  async function elegirArea(a: string) {
    if (!campus) return;
    setArea(a);
    setError(null);
    setCargando(true);
    const res = await fetch(`/api/disponibilidad/roster?campus=${encodeURIComponent(campus)}&area=${encodeURIComponent(a)}`);
    const json = await res.json();
    setCargando(false);
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setRoster(json.data);
    setPaso("nombre");
  }

  function elegirNombre(p: Integrante) {
    setIntegrante(p);
    setPaso("disponibilidad");
  }

  function toggle(clave: string) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      if (clave === SIN_DISPONIBILIDAD) {
        return siguiente.has(SIN_DISPONIBILIDAD) ? new Set() : new Set([SIN_DISPONIBILIDAD]);
      }
      siguiente.delete(SIN_DISPONIBILIDAD);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  async function enviar() {
    if (!campus || !area || !integrante || seleccion.size === 0) return;
    setCargando(true);
    setError(null);
    const res = await fetch("/api/disponibilidad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        area,
        integranteId: integrante.id,
        nombre: integrante.nombre,
        encuentros: Array.from(seleccion),
      }),
    });
    const json = await res.json();
    setCargando(false);
    if (!json.ok) {
      setError(json.error);
      return;
    }
    setPaso("listo");
  }

  function volver(a: typeof paso) {
    setError(null);
    setPaso(a);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="tarjeta" style={{ textAlign: "center", padding: "26px 20px", marginBottom: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cumple/lw.png" alt="ARM Global" style={{ height: 30, margin: "0 auto 12px" }} />
        <h1 style={{ margin: "0 0 4px", fontSize: "1.3rem", color: "var(--gold)" }}>Disponibilidad de servicio ✨</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Selecciona una opción o más.</p>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: "0.78rem", fontStyle: "italic" }}>
          «Sírvanse unos a otros con amor» — Gálatas 5:13
        </p>
      </div>

      {error && <p className="aviso">{error}</p>}

      {contexto && !contexto.abierta ? (
        <div className="tarjeta" style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>🔒 Encuesta cerrada por ahora</p>
          <p className="muted" style={{ margin: 0 }}>{contexto.mensajeCerrada}</p>
        </div>
      ) : (
        <>
      {paso === "area" && (
        <div className="tarjeta">
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>¿En qué equipo sirves?</p>
          <div className="chips">
            {(contexto?.areas ?? []).map((a) => (
              <button key={a} type="button" className="chip" disabled={cargando} onClick={() => elegirArea(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {paso === "nombre" && (
        <div className="tarjeta">
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.8rem" }}>{campus} · {area}</p>
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>¿Quién eres?</p>
          {roster && roster.length === 0 && (
            <p className="muted">No encontramos a nadie de este equipo en la nómina. Avísale a tu líder.</p>
          )}
          <div className="chips">
            {(roster ?? []).map((p) => (
              <button key={p.id} type="button" className="chip" disabled={cargando} onClick={() => elegirNombre(p)}>
                {p.nombre}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); volver("area"); }} style={{ color: "var(--accent)" }}>
              ← Cambiar equipo
            </a>
          </p>
        </div>
      )}

      {paso === "disponibilidad" && (
        <div className="tarjeta">
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.8rem" }}>
            {campus} · {area} · {integrante?.nombre}
          </p>
          <p style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>¿En qué encuentros puedes servir esta semana?</p>
          <div className="chips" style={{ marginBottom: 10 }}>
            {(contexto?.encuentros ?? []).map((enc) => (
              <button
                key={enc.clave}
                type="button"
                className="chip"
                aria-pressed={seleccion.has(enc.clave)}
                disabled={cargando}
                onClick={() => toggle(enc.clave)}
              >
                {enc.etiqueta}
              </button>
            ))}
          </div>
          <div className="chips">
            <button
              type="button"
              className="chip chip-off"
              aria-pressed={seleccion.has(SIN_DISPONIBILIDAD)}
              disabled={cargando}
              onClick={() => toggle(SIN_DISPONIBILIDAD)}
            >
              Sin Disponibilidad 😟
            </button>
          </div>
          <button className="boton" style={{ marginTop: 18 }} disabled={cargando || seleccion.size === 0} onClick={enviar}>
            {cargando ? "Enviando…" : "Enviar"}
          </button>
          <p className="muted" style={{ marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); volver("nombre"); }} style={{ color: "var(--accent)" }}>
              ← No soy yo
            </a>
          </p>
        </div>
      )}

      {paso === "listo" && (
        <div className="tarjeta" style={{ textAlign: "center" }}>
          <p className="ok" style={{ fontSize: "1rem" }}>¡Gracias, {integrante?.nombre}!</p>
          <p className="muted">Tu disponibilidad quedó registrada.</p>
          <p className="muted" style={{ marginTop: 12 }}>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setSeleccion(new Set()); setPaso("disponibilidad"); }}
              style={{ color: "var(--accent)" }}
            >
              Corregir mi respuesta
            </a>
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
