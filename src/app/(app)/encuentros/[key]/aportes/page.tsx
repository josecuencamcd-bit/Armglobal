"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CATEGORIAS, METODOS } from "@/lib/sesiones";

type Aporte = { id: string; nombre: string; monto: number; categoria: string; metodo: string };
type Estado = { key: string; responsable: string; finalizado: boolean; aportes: Aporte[] };

function fechaCL(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
const peso = (n: number) => `$${n.toLocaleString("es-CL")}`;

/**
 * Aportes de un encuentro: pantalla propia (no una pestaña dentro del
 * Reporte) — igual que la app vieja, donde "Aportes" se abre por su
 * propia ruta con el mismo contexto (Encuentro/Fecha/Responsable) arriba:
 * totales por categoría, totales por forma de pago, total general y el
 * formulario rápido (nombre, monto, categoría y un botón de guardado por
 * cada método de pago, en vez de un selector + un botón genérico).
 */
export default function AportesEncuentroPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [guardando, setGuardando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/sesiones/${key}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setEstado(json.data);
    setError(null);
  }, [key]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarComo(metodo: string) {
    const m = Number(monto);
    if (!m || m <= 0) { setError("Escribe un monto mayor a cero."); return; }
    setGuardando(metodo);
    const res = await fetch(`/api/sesiones/${key}/aportes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre || "Sin nombre", monto: m, categoria, metodo }),
    });
    const json = await res.json();
    setGuardando(null);
    if (!json.ok) { setError(json.error); return; }
    setNombre("");
    setMonto("");
    await cargar();
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar este aporte?")) return;
    const res = await fetch(`/api/sesiones/${key}/aportes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  if (!estado && !error) return <div className="contenedor">Cargando…</div>;

  const [campus, encuentro, , fecha] = decodeURIComponent(key).split("|");
  const aportes = estado?.aportes ?? [];
  const porCategoria = CATEGORIAS.map((c) => ({ categoria: c, total: aportes.filter((a) => a.categoria === c).reduce((s, a) => s + a.monto, 0) }));
  const porMetodo = METODOS.map((m) => ({ metodo: m, total: aportes.filter((a) => a.metodo === m).reduce((s, a) => s + a.monto, 0) }));
  const total = aportes.reduce((s, a) => s + a.monto, 0);

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
        <Link href={`/encuentros/${key}`} className="muted" style={{ fontSize: "0.82rem", textDecoration: "none" }}>‹ Reporte</Link>
        <h1 className="titulo" style={{ fontSize: "1.3rem", margin: 0 }}>Aportes</h1>
      </div>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.82rem" }}>
        {encuentro} · {campus} · {fechaCL(fecha)}{estado?.responsable ? ` · Responsable: ${estado.responsable}` : ""}
      </p>
      {error && <p className="aviso">{error}</p>}

      <div className="tarjeta">
        <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>TOTALES POR CATEGORÍA</p>
        {porCategoria.map((c) => (
          <div className="fila" key={c.categoria}><span>{c.categoria}</span><span className="num">{peso(c.total)}</span></div>
        ))}
        <p className="muted" style={{ margin: "14px 0 8px", fontSize: "0.75rem" }}>POR FORMA DE PAGO</p>
        {porMetodo.map((m) => (
          <div className="fila" key={m.metodo}><span>{m.metodo}</span><span className="num">{peso(m.total)}</span></div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
          <div>
            <p className="muted" style={{ margin: 0, fontSize: "0.72rem", textTransform: "uppercase" }}>Total general</p>
            <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>{aportes.length} aporte{aportes.length === 1 ? "" : "s"}</p>
          </div>
          <span className="num" style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent-2)" }}>{peso(total)}</span>
        </div>
      </div>

      {!estado?.finalizado && (
        <div className="tarjeta">
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.75rem" }}>NUEVO APORTE</p>
          <div className="campo">
            <label>Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de quien aporta" />
          </div>
          <div className="campo">
            <label>Monto</label>
            <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" placeholder="10000" />
          </div>
          <div className="campo">
            <label>Categoría</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {CATEGORIAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  style={{
                    padding: "10px 8px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                    border: categoria === c ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: categoria === c ? "var(--gold-grad)" : "var(--surface-2)",
                    color: categoria === c ? "var(--accent-ink)" : "var(--ink)",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="campo" style={{ marginBottom: 0 }}>
            <label>Guardar como pago en</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {METODOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!!guardando}
                  onClick={() => guardarComo(m)}
                  className="boton"
                  style={{ padding: "10px 4px", fontSize: "0.78rem", lineHeight: 1.25 }}
                >
                  {guardando === m ? "…" : (<>Guardar<br />{m}</>)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="muted" style={{ margin: "16px 0 8px" }}>Aportes registrados</p>
      {aportes.length === 0 && <p className="muted">Aún no hay aportes registrados.</p>}
      {aportes.map((a) => (
        <div className="fila" key={a.id}>
          <div>
            <div>{a.nombre}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>{a.categoria} · {a.metodo}</div>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="num">{peso(a.monto)}</span>
            {!estado?.finalizado && (
              <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => borrar(a.id)}>✕</button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
