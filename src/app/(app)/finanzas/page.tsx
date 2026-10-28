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
};

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

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
