"use client";

import { useEffect, useState, useCallback } from "react";
import { GASTOS_ITEMS } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";

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
};

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

/** Módulo Finanzas (informe de campus) — equivalente a Soporte → Finanzas/
 * Informe de la app vieja: ingresos (encuentros + extraordinarios), gastos
 * de campus por ítem, saldo. Contra /api/gastos-campus/informe (lectura) y
 * /api/gastos-campus (registrar gasto), ya existentes. */
export default function FinanzasPage() {
  const { campusActivo } = useCampus();
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [mostrarFormAporte, setMostrarFormAporte] = useState(false);
  const [guardandoAporte, setGuardandoAporte] = useState(false);
  const [esPastor, setEsPastor] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/gastos-campus/informe?campus=${encodeURIComponent(campusActivo)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setInforme(json.data);
    setError(null);
  }, [campusActivo]);

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
    await cargar();
  }

  async function anularAporte(id: number) {
    if (!confirm("¿Anular este aporte?")) return;
    const res = await fetch(`/api/fondos/${id}/anular`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
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
    await cargar();
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
    await cargar();
  }

  if (!informe && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Finanzas</h1>
      {error && <p className="aviso">{error}</p>}

      {informe && (
        <>
          <div className="tarjeta">
            <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>SALDO · {informe.campus} · {informe.mes}</p>
            <p className="num" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "4px 0" }}>{fmt(informe.saldo)}</p>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              Ingresos {fmt(informe.ingresos.total)} (encuentros {fmt(informe.ingresos.encuentros)} + extraordinarios {fmt(informe.ingresos.extraordinarios)}) · Gastos {fmt(informe.egresos)}
            </p>
          </div>

          {informe.cierre.cerrado ? (
            <p className="muted" style={{ fontSize: "0.82rem", marginTop: -4 }}>
              Mes cerrado{informe.cierre.auto ? " automáticamente" : ` por ${informe.cierre.por}`}.
            </p>
          ) : (
            <div className="tarjeta" style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 2px", fontWeight: 600 }}>Cierre de {nombreMes(informe.mes)}</p>
              <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>
                {diasQuedan(informe.mes)} Si no cierras, se cierra solo el día 5.
              </p>
              <button className="boton-secundario" disabled={cerrando} onClick={cerrarMes}>
                {cerrando ? "Cerrando…" : "Cerrar mes"}
              </button>
            </div>
          )}

          {Object.keys(informe.porItem).length > 0 && (
            <div className="tarjeta">
              <p style={{ fontWeight: 600, margin: "0 0 8px" }}>Gastos por ítem</p>
              {Object.entries(informe.porItem).map(([item, monto]) => (
                <div className="fila" key={item}>
                  <span>{item}</span>
                  <span className="num">{fmt(monto)}</span>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ margin: "16px 0 8px" }}>Aportes extraordinarios del mes</p>
          {esPastor && (
            <button className="boton-secundario" style={{ marginBottom: 12 }} onClick={() => setMostrarFormAporte((v) => !v)}>
              {mostrarFormAporte ? "Cerrar" : "+ Registrar aporte extraordinario"}
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

          <button className="boton" style={{ marginBottom: 16, marginTop: 20 }} onClick={() => setMostrarForm((v) => !v)}>
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

          <p className="muted" style={{ margin: "16px 0 8px" }}>Gastos del mes</p>
          {informe.gastos.length === 0 && <p className="muted">Sin gastos este mes.</p>}
          {informe.gastos.map((g) => (
            <div className="fila" key={g.id}>
              <div>
                <div>{g.item}{g.comercio ? ` · ${g.comercio}` : ""}{g.anulado ? " (anulado)" : ""}</div>
                <div className="muted" style={{ fontSize: "0.78rem" }}>{g.fecha} · {g.descripcion}</div>
              </div>
              <span className="num" style={{ color: "var(--danger)" }}>-{fmt(g.monto)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
