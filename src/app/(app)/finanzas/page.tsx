"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GASTOS_ITEMS } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";
import { GraficoLinea } from "@/lib/grafico-linea";

type Informe = {
  campus: string;
  mes: string;
  ingresos: { total: number; encuentros: number; extraordinarios: number };
  egresos: number;
  porItem: Record<string, number>;
  saldo: number;
  gastos: { id: number; fecha: string; item: string; monto: number; comercio: string | null; descripcion: string; anulado: boolean }[];
  extras: { id: number; fecha: string; nombre: string; monto: number; metodo: string; descripcion: string | null; anulado: boolean }[];
  cierre: { cerrado: boolean; por: string; cuando: string; auto: boolean };
  comparacion: { actual: number; anterior: number; pct: number };
  historico: number;
  fondos: { area: string; ingresos: number; egresos: number; anterior: number; saldo: number }[];
  tendencia: { mes: string; monto: number }[];
};

function mesMover(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function nombreMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
}
function diasQuedan(mes: string) {
  const hoy = new Date();
  const act = hoy.toISOString().slice(0, 7);
  if (mes !== act) return "Este mes ya terminó.";
  const ultimo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).getUTCDate();
  const dia = hoy.getUTCDate();
  const q = ultimo - dia;
  return q > 0 ? `Quedan ${q} día${q === 1 ? "" : "s"} para que termine el mes.` : "Último día del mes.";
}

/** Texto del informe mensual para compartir — mismo contenido que
 * docFinanzas() de la app vieja (saldo, ingresos por encuentros/
 * extraordinarios, gastos por ítem, comparación e histórico). */
function textoInforme(inf: Informe): string {
  const lineas = [
    `Finanzas · ${inf.campus}`,
    nombreMes(inf.mes),
    "",
    `Saldo: ${fmt(inf.saldo)}`,
    `Ingresos: ${fmt(inf.ingresos.total)} (encuentros ${fmt(inf.ingresos.encuentros)} + extraordinarios ${fmt(inf.ingresos.extraordinarios)})`,
    `Gastos: ${fmt(inf.egresos)}`,
  ];
  const items = Object.entries(inf.porItem);
  if (items.length) {
    lineas.push("", "Gastos por ítem:");
    for (const [item, monto] of items) lineas.push(`· ${item}: ${fmt(monto)}`);
  }
  lineas.push(
    "",
    `${inf.comparacion.pct >= 0 ? "▲" : "▼"} ${Math.abs(inf.comparacion.pct)}% vs. mes anterior (${fmt(inf.comparacion.anterior)})`,
    `Histórico acumulado: ${fmt(inf.historico)}`
  );
  if (inf.cierre.cerrado) {
    lineas.push("", `Mes cerrado${inf.cierre.auto ? " automáticamente" : ` por ${inf.cierre.por}`}.`);
  }
  return lineas.join("\n");
}

type Tab = "panel" | "aportes" | "gastos" | "informe";
const TABS: { key: Tab; label: string }[] = [
  { key: "panel", label: "Panel" },
  { key: "aportes", label: "Aportes" },
  { key: "gastos", label: "Gastos" },
  { key: "informe", label: "Informe" },
];

/** Módulo Finanzas (informe de campus) — equivalente a Soporte → Finanzas
 * de la app vieja: 4 pestañas (Panel/Aportes/Gastos/Informe), igual que
 * vFinanzas() en Code.gs. Contra /api/gastos-campus/informe (lectura) y
 * /api/gastos-campus + /api/fondos (registrar), ya existentes. */
export default function FinanzasPage() {
  const { campusActivo } = useCampus();
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("panel");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [mostrarFormAporte, setMostrarFormAporte] = useState(false);
  const [guardandoAporte, setGuardandoAporte] = useState(false);
  const [esPastor, setEsPastor] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async (mes?: string) => {
    const qs = new URLSearchParams({ campus: campusActivo });
    if (mes) qs.set("mes", mes);
    const res = await fetch(`/api/gastos-campus/informe?${qs.toString()}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setInforme(json.data);
    setError(null);
  }, [campusActivo]);

  async function anularGasto(id: number) {
    if (!confirm("¿Anular este gasto?")) return;
    const res = await fetch(`/api/gastos-campus/${id}/anular`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar(informe?.mes);
  }

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    fetch("/api/perfil").then((r) => r.json()).then((json) => {
      if (!json.ok) return;
      const roles: string[] = json.data.roles ?? [];
      setEsPastor(roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor"));
    });
  }, []);

  async function registrarAporte(fd: FormData) {
    if (!informe) return;
    setGuardandoAporte(true);
    const res = await fetch("/api/fondos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "aporte",
        campus: informe.campus,
        area: "Campus",
        fecha: fd.get("fecha"),
        nombre: fd.get("nombre"),
        monto: Number(fd.get("monto")),
        metodo: fd.get("metodo"),
        descripcion: fd.get("descripcion") || undefined,
      }),
    });
    const json = await res.json();
    setGuardandoAporte(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarFormAporte(false);
    await cargar(informe.mes);
  }

  async function anularAporte(id: number) {
    if (!confirm("¿Anular este aporte?")) return;
    const res = await fetch(`/api/fondos/${id}/anular`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar(informe?.mes);
  }

  async function registrar(fd: FormData) {
    if (!informe) return;
    setGuardando(true);
    const res = await fetch("/api/gastos-campus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus: informe.campus,
        fecha: fd.get("fecha"),
        item: fd.get("item"),
        monto: Number(fd.get("monto")),
        comercio: fd.get("comercio") || undefined,
        boleta: fd.get("boleta") || undefined,
        descripcion: fd.get("descripcion"),
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    await cargar(informe.mes);
  }

  async function cerrarMes() {
    if (!informe) return;
    setCerrando(true);
    const res = await fetch("/api/fondos/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus: informe.campus, area: "Campus", mes: informe.mes }),
    });
    const json = await res.json();
    setCerrando(false);
    if (!json.ok) { setError(json.error); return; }
    await cargar(informe.mes);
  }

  async function compartirInforme() {
    if (!informe) return;
    const texto = textoInforme(informe);
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch { /* el usuario canceló */ }
    }
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  if (!informe && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Finanzas</h1>
      {error && <p className="aviso">{error}</p>}

      {informe && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 10px" }}>
            <button className="boton-secundario" onClick={() => cargar(mesMover(informe.mes, -1))}>‹</button>
            <strong>{nombreMes(informe.mes)}</strong>
            <button className="boton-secundario" onClick={() => cargar(mesMover(informe.mes, 1))}>›</button>
          </div>

          <div className="seg" style={{ marginBottom: 16 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                aria-pressed={tab === t.key}
                onClick={() => { setTab(t.key); setMostrarForm(false); setMostrarFormAporte(false); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "panel" && (
            <>
              <div className="tarjeta">
                <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>SALDO · {informe.campus} · {informe.mes}</p>
                <p className="num" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "4px 0" }}>{fmt(informe.saldo)}</p>
                <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                  Ingresos {fmt(informe.ingresos.total)} (encuentros {fmt(informe.ingresos.encuentros)} + extraordinarios {fmt(informe.ingresos.extraordinarios)}) · Gastos {fmt(informe.egresos)}
                </p>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
                  {informe.comparacion.pct >= 0 ? "▲" : "▼"} {Math.abs(informe.comparacion.pct)}% vs. mes anterior ({fmt(informe.comparacion.anterior)}) · Histórico {fmt(informe.historico)}
                </p>
                {informe.tendencia.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <GraficoLinea datos={informe.tendencia} />
                  </div>
                )}
              </div>

              {informe.cierre.cerrado ? (
                <p className="muted" style={{ fontSize: "0.82rem", marginTop: 10 }}>
                  Mes cerrado{informe.cierre.auto ? " automáticamente" : ` por ${informe.cierre.por}`}.
                </p>
              ) : (
                <div className="tarjeta" style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 600 }}>Cierre de {nombreMes(informe.mes)}</p>
                  <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
                    {diasQuedan(informe.mes)} Si no cierras, se cierra solo el día 5.
                  </p>
                  <button className="boton-secundario" disabled={cerrando} onClick={cerrarMes}>
                    {cerrando ? "Cerrando…" : "Cerrar mes"}
                  </button>
                </div>
              )}

              {informe.fondos.length > 0 && (
                <div className="tarjeta" style={{ marginTop: 12 }}>
                  <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Fondos de equipo, aparte</p>
                  <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem" }}>
                    Cada equipo lleva su propio fondo — no está incluido en el saldo de arriba.
                  </p>
                  {informe.fondos.map((f) => (
                    <div className="fila" key={f.area}>
                      <span>{f.area}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="num">{fmt(f.saldo)}</span>
                        <Link href={`/fondos?area=${encodeURIComponent(f.area)}`} className="boton-secundario" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
                          Ver detalle
                        </Link>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(informe.porItem).length > 0 && (
                <div className="tarjeta" style={{ marginTop: 12 }}>
                  <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Gastos por ítem</p>
                  {Object.entries(informe.porItem).map(([item, monto]) => (
                    <div className="fila" key={item}>
                      <span>{item}</span>
                      <span className="num">{fmt(monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "aportes" && (
            <>
              {esPastor && (
                <button className="boton" style={{ marginBottom: 12 }} onClick={() => setMostrarFormAporte((v) => !v)}>
                  {mostrarFormAporte ? "Cerrar" : "Registrar aporte extraordinario"}
                </button>
              )}
              {mostrarFormAporte && (
                <form className="tarjeta" action={(fd) => registrarAporte(fd)} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                  <div className="campo">
                    <label>Fecha</label>
                    <input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                  </div>
                  <div className="campo">
                    <label>Quién aporta</label>
                    <input name="nombre" required minLength={3} />
                  </div>
                  <div className="campo">
                    <label>Monto</label>
                    <input name="monto" type="number" required />
                  </div>
                  <div className="campo">
                    <label>¿Cómo aportó?</label>
                    <select name="metodo">
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div className="campo">
                    <label>Nota (opcional)</label>
                    <textarea name="descripcion" rows={2} />
                  </div>
                  <button className="boton" type="submit" disabled={guardandoAporte}>
                    {guardandoAporte ? "Guardando…" : "Registrar"}
                  </button>
                </form>
              )}
              <p className="muted" style={{ margin: "16px 0 8px" }}>Aportes extraordinarios de {nombreMes(informe.mes)}</p>
              {informe.extras.length === 0 && <p className="muted">No hay aportes extraordinarios este mes.</p>}
              {informe.extras.map((x) => (
                <div className="fila" key={x.id}>
                  <div>
                    <div>{x.nombre}{x.anulado ? " (anulado)" : ""}</div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{x.fecha} · {x.metodo}{x.descripcion ? ` · ${x.descripcion}` : ""}</div>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="num" style={{ color: "var(--ok)" }}>+{fmt(x.monto)}</span>
                    {esPastor && !x.anulado && (
                      <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => anularAporte(x.id)}>
                        Anular
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </>
          )}

          {tab === "gastos" && (
            <>
              <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
                {mostrarForm ? "Cerrar" : "Registrar gasto"}
              </button>

              {mostrarForm && (
                <form className="tarjeta" action={(fd) => registrar(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="campo">
                    <label>Fecha</label>
                    <input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                  </div>
                  <div className="campo">
                    <label>Ítem</label>
                    <select name="item">
                      {GASTOS_ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="campo">
                    <label>Monto</label>
                    <input name="monto" type="number" required />
                  </div>
                  <div className="campo">
                    <label>Comercio</label>
                    <input name="comercio" />
                  </div>
                  <div className="campo">
                    <label>N° de boleta</label>
                    <input name="boleta" />
                  </div>
                  <div className="campo">
                    <label>Descripción</label>
                    <textarea name="descripcion" rows={2} required />
                  </div>
                  <button className="boton" type="submit" disabled={guardando}>
                    {guardando ? "Guardando…" : "Registrar"}
                  </button>
                </form>
              )}

              <p className="muted" style={{ margin: "16px 0 8px" }}>Gastos de {nombreMes(informe.mes)}</p>
              {informe.gastos.length === 0 && <p className="muted">Sin gastos este mes.</p>}
              {informe.gastos.map((g) => (
                <div className="fila" key={g.id}>
                  <div>
                    <div>{g.item}{g.comercio ? ` · ${g.comercio}` : ""}{g.anulado ? " (anulado)" : ""}</div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{g.fecha} · {g.descripcion}</div>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="num" style={{ color: "var(--danger)" }}>-{fmt(g.monto)}</span>
                    {!g.anulado && (
                      <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => anularGasto(g.id)}>
                        Anular
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </>
          )}

          {tab === "informe" && (
            <div className="tarjeta">
              <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>INFORME · LISTO PARA COMPARTIR</p>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.88rem", margin: "0 0 14px" }}>
                {textoInforme(informe)}
              </pre>
              <button className="boton" onClick={compartirInforme}>
                {copiado ? "Copiado ✓" : "Compartir / copiar"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
