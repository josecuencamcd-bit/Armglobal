"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AREAS } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";
import { VolverAdministracion } from "@/lib/volver-admin";

type Fila = { id: number; integrante_id: number; nombre: string; estado: string | null; observacion: string | null; respuesta: string | null };
type Integrante = { id: number; nombre: string; rol_servicio: string | null };
type Administracion = { administradores: string[]; lideres: string[] } | null;
type Datos = {
  fecha: string;
  campus: string;
  area: string;
  puedeEditar: boolean;
  finalizado: boolean;
  nota: string;
  filas: Fila[];
  integrantes: Integrante[];
  administracion: Administracion;
  faltantes: string[];
};
type Perfil = { nombre: string; roles: string[]; areas: string[]; campus: string | null };

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
const ES_FINANZAS = ["Pastor principal", "Pastor de campus", "Pastor", "Ministro", "Administrador", "Admin app"];

/** vAsistencia: el líder marca quién vino/no vino en cada encuentro, ve
 * quién administra, escribe la nota y finaliza — equivalente a
 * api_ecoAsistencia/Programar/Marcar/Nota/Finalizar de la app vieja. */
export default function AsistenciaPage() {
  return (
    <Suspense fallback={<div className="contenedor">Cargando…</div>}>
      <AsistenciaContenido />
    </Suspense>
  );
}

function AsistenciaContenido() {
  const supabase = createClient();
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const areaParam = useSearchParams().get("area");

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [fecha, setFecha] = useState(hoyISO());
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notaTexto, setNotaTexto] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [okNota, setOkNota] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [checklistAbierto, setChecklistAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [guardandoLista, setGuardandoLista] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("perfiles").select("nombre, roles, areas, campus").eq("id", user.id).maybeSingle();
      if (!cancelado && data) setPerfil(data as unknown as Perfil);
    })();
    return () => { cancelado = true; };
  }, [supabase]);

  // Igual que ctxEco_: un líder puro queda fijo a sus propias áreas; quien
  // además es Pastor/Ministro/Administrador/Admin app puede elegir
  // cualquiera (para ver, aunque solo el líder real pueda marcar).
  const esFinanzas = perfil ? perfil.roles.some((r) => ES_FINANZAS.includes(r)) : false;
  const areasDisponibles = perfil
    ? esFinanzas
      ? [...AREAS]
      : (AREAS as readonly string[]).filter((a) => perfil.areas.includes(a))
    : [];

  useEffect(() => {
    if (!perfil || area) return;
    const inicial = areaParam && areasDisponibles.includes(areaParam) ? areaParam : areasDisponibles[0];
    if (inicial) setArea(inicial);
  }, [perfil, areaParam, areasDisponibles, area]);

  const cargar = useCallback(async (c: string, a: string, f: string) => {
    setMensaje(null);
    const res = await fetch(`/api/asistencia?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}&fecha=${f}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); setDatos(null); return; }
    setError(null);
    setDatos(json.data);
    setNotaTexto(json.data.nota ?? "");
  }, []);

  useEffect(() => {
    if (area) cargar(campus, area, fecha);
  }, [campus, area, fecha, cargar]);

  async function marcar(fila: Fila, estado: string) {
    if (!area || !datos) return;
    const nuevoEstado = fila.estado === estado ? "" : estado;
    setDatos({ ...datos, filas: datos.filas.map((f) => (f.id === fila.id ? { ...f, estado: nuevoEstado } : f)) });
    await fetch("/api/asistencia/marcar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, area, fecha, integranteId: fila.integrante_id, estado: nuevoEstado, obs: fila.observacion ?? "" }),
    });
  }

  async function guardarObs(fila: Fila, obs: string) {
    if (!area) return;
    await fetch("/api/asistencia/marcar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, area, fecha, integranteId: fila.integrante_id, estado: fila.estado ?? "", obs }),
    });
  }

  async function guardarNota() {
    if (!area) return;
    setGuardandoNota(true);
    const res = await fetch("/api/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, area, fecha, nota: notaTexto }),
    });
    const json = await res.json();
    setGuardandoNota(false);
    if (json.ok) { setOkNota(true); setTimeout(() => setOkNota(false), 1600); }
  }

  function resumenCompartir() {
    if (!datos) return "";
    const vivos = datos.filas;
    const g: Record<string, string[]> = { Vino: [], "No vino": [], "": [] };
    vivos.forEach((p) => {
      const k = p.estado === "Vino" || p.estado === "No vino" ? p.estado : "";
      g[k].push(p.nombre + (p.observacion ? ` (${p.observacion})` : ""));
    });
    const [y, m, d] = fecha.split("-");
    const t = [`*armglobal* - ${area} - Campus ${campus}`, `Encuentro del ${d}/${m}/${y}`, `Asistieron ${g.Vino.length} de ${vivos.length}`, ""];
    if (g.Vino.length) t.push(`✅ Vinieron (${g.Vino.length}): ${g.Vino.join(", ")}`);
    if (g["No vino"].length) t.push(`❌ No vinieron (${g["No vino"].length}): ${g["No vino"].join(", ")}`);
    if (g[""].length) t.push(`⏳ Sin marcar (${g[""].length}): ${g[""].join(", ")}`);
    if (notaTexto) { t.push(""); t.push(`Notas del encuentro: ${notaTexto}`); }
    return t.join("\n");
  }

  async function finalizar() {
    if (!area || !datos) return;
    setFinalizando(true);
    const res = await fetch("/api/asistencia/finalizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, area, fecha, nota: notaTexto }),
    });
    const json = await res.json();
    setFinalizando(false);
    if (!json.ok) { setError(json.error); return; }
    setMensaje(json.data.mensaje);
    cargar(campus, area, fecha);
  }

  function abrirChecklist() {
    if (!datos) return;
    setSeleccion(new Set(datos.filas.map((f) => f.integrante_id)));
    setChecklistAbierto(true);
  }

  async function guardarLista() {
    if (!area) return;
    setGuardandoLista(true);
    await fetch("/api/asistencia/programar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, area, fecha, ids: [...seleccion] }),
    });
    setGuardandoLista(false);
    setChecklistAbierto(false);
    cargar(campus, area, fecha);
  }

  if (!perfil || !area) return <div className="contenedor">Cargando…</div>;

  const ed = !!datos && !datos.finalizado && datos.puedeEditar;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem", margin: 0 }}>Asistencia</h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campus}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>

      <div className="tarjeta" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {areasDisponibles.length > 1 ? (
          <div className="campo" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label>Área</label>
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              {areasDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        ) : (
          <p style={{ margin: 0, fontWeight: 600, flex: 1 }}>{area}</p>
        )}
        <div className="campo" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
          <label>Fecha del encuentro</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {error && <p className="aviso">{error}</p>}

      {datos && (
        <>
          {datos.finalizado ? (
            <p className="aviso">Encuentro finalizado. Solo lectura.</p>
          ) : !datos.puedeEditar ? (
            <p className="aviso">Solo el líder del área marca la asistencia. Aquí la puedes ver.</p>
          ) : null}

          {datos.administracion && (
            <div className="tarjeta">
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase" }}>Administración de este encuentro</p>
              {datos.administracion.administradores.length > 0 && (
                <p style={{ margin: "2px 0" }}><b>Administradores de campus</b><br /><span className="muted">{datos.administracion.administradores.join(", ")}</span></p>
              )}
              {datos.administracion.lideres.length > 0 && (
                <p style={{ margin: "2px 0" }}><b>Lideran el equipo hoy</b><br /><span className="muted">{datos.administracion.lideres.join(", ")}</span></p>
              )}
            </div>
          )}

          {datos.faltantes.length > 0 && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              La ficha menciona a {datos.faltantes.join(", ")}, pero no {datos.faltantes.length === 1 ? "está registrado" : "están registrados"} en Mi equipo.
            </p>
          )}

          <div className="tarjeta">
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.78rem", textTransform: "uppercase" }}>Quiénes sirven hoy</p>
            {!datos.filas.length && <p className="muted">Todavía no hay nadie definido para este día.</p>}
            {datos.filas.map((f) => (
              <div key={f.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <b>{f.nombre}</b>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      disabled={!ed}
                      onClick={() => marcar(f, "Vino")}
                      style={{
                        border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px", cursor: ed ? "pointer" : "default",
                        background: f.estado === "Vino" ? "var(--ok)" : "var(--surface-2)", color: f.estado === "Vino" ? "#0b0b0d" : "inherit",
                      }}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      disabled={!ed}
                      onClick={() => marcar(f, "No vino")}
                      style={{
                        border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px", cursor: ed ? "pointer" : "default",
                        background: f.estado === "No vino" ? "var(--danger)" : "var(--surface-2)", color: f.estado === "No vino" ? "#fff" : "inherit",
                      }}
                    >
                      ✗
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  defaultValue={f.observacion ?? ""}
                  disabled={!ed}
                  placeholder="Observación"
                  onBlur={(e) => guardarObs(f, e.target.value)}
                  style={{ marginTop: 6, width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", padding: "6px 10px", fontSize: "0.85rem" }}
                />
              </div>
            ))}
          </div>

          <div className="tarjeta">
            <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase" }}>Notas del encuentro</p>
            <textarea
              rows={4}
              maxLength={1000}
              value={notaTexto}
              disabled={!ed}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Por ejemplo: tuvimos 17 niños; actividad: manualidad de la historia"
              style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", padding: "10px 12px" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {ed && (
                <button className="boton-secundario" style={{ width: "auto" }} disabled={guardandoNota} onClick={guardarNota}>
                  {guardandoNota ? "Guardando…" : "Guardar nota"}
                </button>
              )}
              <a
                className="boton-secundario"
                style={{ width: "auto", textAlign: "center", textDecoration: "none" }}
                href={`https://wa.me/?text=${encodeURIComponent(resumenCompartir())}`}
                target="_blank"
                rel="noopener"
              >
                Compartir resumen por WhatsApp
              </a>
              {ed && (
                <button className="boton" style={{ width: "auto" }} disabled={finalizando} onClick={finalizar}>
                  {finalizando ? "Finalizando…" : "Finalizar encuentro"}
                </button>
              )}
            </div>
            {okNota && <p className="ok">Nota guardada.</p>}
          </div>

          {mensaje && (
            <div className="tarjeta">
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase" }}>Resumen del encuentro</p>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: "0 0 10px" }}>{mensaje}</pre>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="boton-secundario" style={{ width: "auto" }} onClick={() => navigator.clipboard?.writeText(mensaje)}>Copiar</button>
                <a className="boton boton-share" style={{ width: "auto", textAlign: "center", textDecoration: "none" }} href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener">Abrir WhatsApp</a>
              </div>
            </div>
          )}

          {ed && (
            <div className="tarjeta">
              {!checklistAbierto ? (
                <button className="boton-secundario" onClick={abrirChecklist}>Cambiar quiénes sirven</button>
              ) : (
                <>
                  <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase" }}>Cambiar quiénes sirven</p>
                  {!datos.integrantes.length && <p className="muted">Primero agrega integrantes en Mi equipo.</p>}
                  {datos.integrantes.map((p) => (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <input
                        type="checkbox"
                        checked={seleccion.has(p.id)}
                        onChange={(e) => {
                          const n = new Set(seleccion);
                          if (e.target.checked) n.add(p.id); else n.delete(p.id);
                          setSeleccion(n);
                        }}
                      />
                      <span>{p.nombre}{p.rol_servicio ? ` · ${p.rol_servicio}` : ""}</span>
                    </label>
                  ))}
                  {datos.integrantes.length > 0 && (
                    <button className="boton-secundario" style={{ marginTop: 8 }} disabled={guardandoLista} onClick={guardarLista}>
                      {guardandoLista ? "Guardando…" : "Guardar lista"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
