"use client";

import { useEffect, useState, useCallback } from "react";
import { METODOS_FONDO, CATEG_GASTO } from "@/lib/sesiones";

type Informe = {
  area: string;
  campus: string;
  saldo: number;
  ingresos: number;
  egresos: number;
  areas: string[];
  puedeEditar: boolean;
};

type Movimiento = {
  id: number;
  tipo: "aporte" | "gasto";
  fecha: string;
  monto: number;
  nombre?: string | null;
  comercio?: string | null;
  descripcion?: string | null;
  anulado: boolean;
};

const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;

/** Módulo Fondos (fondo de equipo) — equivalente a Soporte → Fondo de la
 * app vieja: saldo del mes, registrar aporte/gasto, movimientos. Contra
 * /api/fondos/informe y /api/fondos, ya existentes. Se deja fuera por ahora
 * el cierre de mes y las autorizaciones (siguiente vuelta). */
export default function FondosPage() {
  const [informe, setInforme] = useState<Informe | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"aporte" | "gasto">("aporte");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (a: string | null) => {
    const url = a ? `/api/fondos/informe?area=${encodeURIComponent(a)}` : "/api/fondos/informe";
    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setInforme(json.data);
    setArea(json.data.area);
    setError(null);
    const rm = await fetch(`/api/fondos?campus=${encodeURIComponent(json.data.campus)}&area=${encodeURIComponent(json.data.area)}`);
    const jm = await rm.json();
    if (jm.ok) setMovs(jm.data.slice(0, 20));
  }, []);

  useEffect(() => {
    cargar(null);
  }, [cargar]);

  async function registrar(fd: FormData) {
    if (!informe) return;
    setGuardando(true);
    const body: Record<string, unknown> = {
      tipo,
      fecha: fd.get("fecha"),
      campus: informe.campus,
      area: informe.area,
      monto: Number(fd.get("monto")),
    };
    if (tipo === "aporte") {
      body.nombre = fd.get("nombre");
      body.metodo = fd.get("metodo");
      body.descripcion = fd.get("descripcion") || undefined;
    } else {
      body.comercio = fd.get("comercio");
      body.boleta = fd.get("boleta");
      body.categoria = fd.get("categoria");
      body.descripcion = fd.get("descripcion");
    }
    const res = await fetch("/api/fondos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    await cargar(area);
  }

  if (!informe && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Fondos</h1>
      {error && <p className="aviso">{error}</p>}

      {informe && (
        <>
          {informe.areas.length > 1 && (
            <div className="campo">
              <label>Equipo</label>
              <select value={area ?? informe.area} onChange={(e) => cargar(e.target.value)}>
                {informe.areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          <div className="tarjeta">
            <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>SALDO · {informe.area} · {informe.campus}</p>
            <p className="num" style={{ fontSize: "1.8rem", fontWeight: 700, margin: "4px 0" }}>{fmt(informe.saldo)}</p>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              Ingresos {fmt(informe.ingresos)} · Gastos {fmt(informe.egresos)}
            </p>
          </div>

          {informe.puedeEditar && (
            <>
              <div className="seg" style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                {(["aporte", "gasto"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    style={{
                      flex: 1, padding: "10px", border: 0, cursor: "pointer",
                      background: tipo === t ? "var(--accent)" : "transparent",
                      color: tipo === t ? "var(--accent-ink)" : "var(--muted)", fontWeight: 600,
                    }}
                  >
                    {t === "aporte" ? "Aporte" : "Gasto"}
                  </button>
                ))}
              </div>

              <button className="boton" style={{ marginBottom: 16 }} onClick={() => setMostrarForm((v) => !v)}>
                {mostrarForm ? "Cerrar" : `Registrar ${tipo}`}
              </button>

              {mostrarForm && (
                <form className="tarjeta" action={(fd) => registrar(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="campo">
                    <label>Fecha</label>
                    <input name="fecha" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                  </div>
                  <div className="campo">
                    <label>Monto</label>
                    <input name="monto" type="number" required />
                  </div>
                  {tipo === "aporte" ? (
                    <>
                      <div className="campo">
                        <label>Quién aporta</label>
                        <input name="nombre" required />
                      </div>
                      <div className="campo">
                        <label>Método</label>
                        <select name="metodo">
                          {METODOS_FONDO.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="campo">
                        <label>Comercio</label>
                        <input name="comercio" required />
                      </div>
                      <div className="campo">
                        <label>N° de boleta</label>
                        <input name="boleta" placeholder="o S/B si no tiene" required />
                      </div>
                      <div className="campo">
                        <label>Categoría</label>
                        <select name="categoria">
                          {CATEG_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="campo">
                    <label>Descripción</label>
                    <textarea name="descripcion" rows={2} required={tipo === "gasto"} />
                  </div>
                  <button className="boton" type="submit" disabled={guardando}>
                    {guardando ? "Guardando…" : "Registrar"}
                  </button>
                </form>
              )}
            </>
          )}

          <p className="muted" style={{ margin: "16px 0 8px" }}>Últimos movimientos</p>
          {movs?.length === 0 && <p className="muted">Sin movimientos registrados.</p>}
          {movs?.map((m) => (
            <div className="fila" key={m.id}>
              <div>
                <div>{m.tipo === "aporte" ? m.nombre : m.comercio}{m.anulado ? " (anulado)" : ""}</div>
                <div className="muted" style={{ fontSize: "0.78rem" }}>{m.fecha} · {m.tipo}</div>
              </div>
              <span className="num" style={{ color: m.tipo === "aporte" ? "var(--ok)" : "var(--danger)" }}>
                {m.tipo === "aporte" ? "+" : "-"}{fmt(m.monto)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
