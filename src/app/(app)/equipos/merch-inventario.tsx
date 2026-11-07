"use client";

import { useCallback, useEffect, useState } from "react";
import { TALLAS } from "@/lib/sesiones";

type Articulo = { id: number; campus: string; tipo: string; talla: string; stock: number };
type Informe = {
  stock: Articulo[];
  ventas: { tipo: string; talla: string; cantidad: number; movimientos: number }[];
  totalVendido: number;
  desde: string | null;
  hasta: string | null;
};

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function hace30DiasISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

/** Panel de inventario de Merch (cargar stock, registrar ventas, informe
 * de lo vendido en un rango) — solo tiene sentido dentro de "Mi equipo"
 * cuando area === "Merch"; el padre ya se encarga de eso. RLS de
 * merch_articulos/merch_movimientos limita todo a área Merch o Finanzas,
 * así que no hace falta repetir el chequeo acá. */
export default function MerchInventario({ campus }: { campus: string }) {
  const [articulos, setArticulos] = useState<Articulo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardandoMov, setGuardandoMov] = useState(false);

  const [desde, setDesde] = useState(hace30DiasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [informe, setInforme] = useState<Informe | null>(null);
  const [cargandoInforme, setCargandoInforme] = useState(false);

  const cargarArticulos = useCallback(async () => {
    const res = await fetch(`/api/merch/articulos?campus=${encodeURIComponent(campus)}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setArticulos(json.data);
  }, [campus]);

  useEffect(() => {
    cargarArticulos();
  }, [cargarArticulos]);

  async function registrarMovimiento(fd: FormData, tipo_mov: "Entrada" | "Venta") {
    setGuardandoMov(true);
    setError(null);
    const res = await fetch("/api/merch/articulos/movimiento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        tipo: fd.get("tipo"),
        talla: fd.get("talla"),
        cantidad: Number(fd.get("cantidad") || 1),
        tipo_mov,
        nota: fd.get("nota") || undefined,
      }),
    });
    const json = await res.json();
    setGuardandoMov(false);
    if (!json.ok) { setError(json.error); return; }
    await cargarArticulos();
    if (informe) await generarInforme();
  }

  const generarInforme = useCallback(async () => {
    setCargandoInforme(true);
    setError(null);
    const res = await fetch(
      `/api/merch/articulos/informe?campus=${encodeURIComponent(campus)}&desde=${desde}&hasta=${hasta}`
    );
    const json = await res.json();
    setCargandoInforme(false);
    if (!json.ok) { setError(json.error); return; }
    setInforme(json.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, desde, hasta]);

  const stockDe = (tipo: string, talla: string) =>
    articulos?.find((a) => a.tipo === tipo && a.talla === talla)?.stock ?? 0;

  return (
    <div className="tarjeta stack" style={{ marginBottom: 16 }}>
      <span className="label">Inventario Merch</span>
      {error && <p className="aviso">{error}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(["Polera", "Polerón"] as const).map((tipo) =>
          TALLAS.map((talla) => (
            <span
              key={`${tipo}-${talla}`}
              className="chip"
              style={{ fontSize: "0.75rem", padding: "4px 9px", minHeight: "auto" }}
            >
              {tipo} {talla}: <b>{stockDe(tipo, talla)}</b>
            </span>
          ))
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
        <form
          className="tarjeta"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
          action={(fd) => registrarMovimiento(fd, "Entrada")}
        >
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Cargar inventario (entrada de stock)</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Prenda</label>
              <select name="tipo" defaultValue="Polera">
                <option value="Polera">Polera</option>
                <option value="Polerón">Polerón</option>
              </select>
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Talla</label>
              <select name="talla" defaultValue="M">
                {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="campo" style={{ width: 90 }}>
              <label>Cantidad</label>
              <input name="cantidad" type="number" min={1} max={10000} defaultValue={1} />
            </div>
          </div>
          <div className="campo">
            <label>Nota (opcional)</label>
            <input name="nota" placeholder="Ej: compra proveedor X" />
          </div>
          <button className="boton" type="submit" disabled={guardandoMov}>
            {guardandoMov ? "Guardando…" : "Cargar al inventario"}
          </button>
        </form>

        <form
          className="tarjeta"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
          action={(fd) => registrarMovimiento(fd, "Venta")}
        >
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Registrar una venta (rebaja el stock sola)</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Prenda</label>
              <select name="tipo" defaultValue="Polera">
                <option value="Polera">Polera</option>
                <option value="Polerón">Polerón</option>
              </select>
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Talla</label>
              <select name="talla" defaultValue="M">
                {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="campo" style={{ width: 90 }}>
              <label>Cantidad</label>
              <input name="cantidad" type="number" min={1} max={10000} defaultValue={1} />
            </div>
          </div>
          <div className="campo">
            <label>Nota (opcional)</label>
            <input name="nota" placeholder="Ej: venta en stand domingo" />
          </div>
          <button className="boton" type="submit" disabled={guardandoMov}>
            {guardandoMov ? "Guardando…" : "Registrar venta"}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>Informe de ventas</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="campo" style={{ flex: 1, minWidth: 130 }}>
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="campo" style={{ flex: 1, minWidth: 130 }}>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <button
            type="button"
            className="boton-secundario"
            style={{ width: "auto", padding: "0 14px", height: 44 }}
            onClick={generarInforme}
            disabled={cargandoInforme}
          >
            {cargandoInforme ? "Generando…" : "Generar informe"}
          </button>
        </div>

        {informe && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              <b>{informe.totalVendido}</b> unidades vendidas/entregadas entre {informe.desde} y {informe.hasta}
            </p>
            {informe.ventas.length === 0 && <p className="muted">Sin movimientos en ese rango.</p>}
            {informe.ventas.map((v) => (
              <div key={`${v.tipo}-${v.talla}`} className="eco-row">
                <div>
                  <b>{v.tipo} {v.talla}</b>
                  <small>{v.movimientos} {v.movimientos === 1 ? "movimiento" : "movimientos"}</small>
                </div>
                <span className="eco-badge ok">{v.cantidad} un.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
