"use client";

import { useEffect, useState, useCallback } from "react";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Item = { nombre: string; campus: string; area: string; mes: number; dia: number; edad: number; hoy: boolean; faltan: number | null };
type Datos = { hoy: string; mes: number; mesHoy: number; todo: boolean; lista: Item[] };
type Propuesta = { id: number; nombres: string; fecha: string; mensaje: string | null; estado: string };

/** Módulo Cumpleaños: próximos cumpleaños (todo el año o por mes, con área y
 * edad) + propuestas del vigilante automático para aprobar/anular —
 * equivalente a api_ecoCumples / api_cumpleProps / api_cumpleAprobar /
 * api_cumpleAnular. */
export default function CumpleanosPage() {
  const [modo, setModo] = useState<"todo" | "mes">("todo");
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [propuestas, setPropuestas] = useState<Propuesta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<number | null>(null);

  const cargar = useCallback(async (m: "todo" | "mes", mes: number) => {
    const qs = m === "todo" ? "?todo=1" : `?mes=${mes}`;
    const [rp, rq] = await Promise.all([fetch(`/api/cumpleanos${qs}`), fetch("/api/cumpleanos/propuestas")]);
    const [jp, jq] = await Promise.all([rp.json(), rq.json()]);
    if (!jp.ok) { setError(jp.error); return; }
    setDatos(jp.data);
    if (jq.ok) setPropuestas(jq.data.filter((p: Propuesta) => p.estado === "Pendiente"));
    setError(null);
  }, []);

  useEffect(() => {
    cargar(modo, mesSel);
  }, [modo, mesSel, cargar]);

  async function resolver(id: number, accion: "aprobar" | "anular") {
    setResolviendo(id);
    const res = await fetch(`/api/cumpleanos/propuestas/${id}/${accion}`, { method: "PATCH" });
    const json = await res.json();
    setResolviendo(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar(modo, mesSel);
  }

  if (!datos && !error) return <div className="contenedor">Cargando…</div>;

  // Agrupa por mes (solo relevante en modo "todo el año").
  const grupos: { mes: number; items: Item[] }[] = [];
  for (const item of datos?.lista ?? []) {
    let g = grupos.find((x) => x.mes === item.mes);
    if (!g) { g = { mes: item.mes, items: [] }; grupos.push(g); }
    g.items.push(item);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Cumpleaños</h1>
      {error && <p className="aviso">{error}</p>}

      {propuestas && propuestas.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <p className="muted" style={{ marginBottom: 8 }}>Saludos pendientes de aprobar</p>
          {propuestas.map((p) => (
            <div className="tarjeta" key={p.id}>
              <p style={{ fontWeight: 600, margin: 0 }}>{p.nombres}</p>
              <p className="muted" style={{ margin: "2px 0 8px", fontSize: "0.8rem" }}>{p.fecha}</p>
              {p.mensaje && <p style={{ margin: "0 0 10px", fontSize: "0.88rem" }}>{p.mensaje}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="boton" style={{ flex: 1 }} disabled={resolviendo === p.id} onClick={() => resolver(p.id, "aprobar")}>
                  Aprobar y enviar
                </button>
                <button className="boton-peligro" style={{ flex: 1 }} disabled={resolviendo === p.id} onClick={() => resolver(p.id, "anular")}>
                  Anular
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setModo("todo")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 600, cursor: "pointer",
            border: modo === "todo" ? "none" : "1px solid var(--line)",
            background: modo === "todo" ? "var(--gold-grad)" : "var(--surface-2)",
            color: modo === "todo" ? "var(--accent-ink)" : "var(--ink)",
          }}
        >
          Todo el año
        </button>
        <button
          onClick={() => setModo("mes")}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 600, cursor: "pointer",
            border: modo === "mes" ? "none" : "1px solid var(--line)",
            background: modo === "mes" ? "var(--gold-grad)" : "var(--surface-2)",
            color: modo === "mes" ? "var(--accent-ink)" : "var(--ink)",
          }}
        >
          Por mes
        </button>
      </div>

      {modo === "mes" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button className="boton-secundario" onClick={() => setMesSel((m) => (m === 1 ? 12 : m - 1))}>‹</button>
          <span style={{ fontWeight: 600 }}>{MESES_LARGO[mesSel - 1]}</span>
          <button className="boton-secundario" onClick={() => setMesSel((m) => (m === 12 ? 1 : m + 1))}>›</button>
        </div>
      )}

      {datos?.lista.length === 0 && <p className="muted">Nadie cumple años {modo === "todo" ? "" : "en " + MESES_LARGO[mesSel - 1]}.</p>}

      {modo === "todo"
        ? grupos.map((g) => (
            <div key={g.mes} style={{ marginBottom: 18 }}>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {MESES_LARGO[g.mes - 1]}{g.mes === datos?.mesHoy ? " · Este mes" : ""}
              </p>
              {g.items.map((i, idx) => <ItemCumple key={i.nombre + idx} i={i} />)}
            </div>
          ))
        : datos?.lista.map((i, idx) => <ItemCumple key={i.nombre + idx} i={i} />)}
    </div>
  );
}

function ItemCumple({ i }: { i: Item }) {
  return (
    <div className="tarjeta" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
      <div
        style={{
          flexShrink: 0, width: 54, textAlign: "center", borderRadius: 10, overflow: "hidden",
          border: "1px solid var(--hud-line-2)",
        }}
      >
        <div style={{ background: "var(--gold-grad)", color: "var(--accent-ink)", fontSize: "0.68rem", fontWeight: 700, padding: "2px 0", textTransform: "uppercase" }}>
          {MESES[i.mes - 1]}
        </div>
        <div style={{ background: "var(--surface-2)", fontWeight: 700, fontSize: "1.1rem", padding: "4px 0" }}>
          {String(i.dia).padStart(2, "0")}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, margin: 0 }}>{i.nombre}</p>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
          {i.area} · {i.campus}{i.faltan != null && !i.hoy ? ` · en ${i.faltan} días` : i.hoy ? " · Hoy" : ""}
        </p>
      </div>
      <span className="num" style={{ fontWeight: 700, fontSize: "1rem" }}>{i.edad}<span className="muted" style={{ fontSize: "0.7rem", fontWeight: 400 }}> años</span></span>
    </div>
  );
}
