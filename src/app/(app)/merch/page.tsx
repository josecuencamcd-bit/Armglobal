"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCampus } from "@/lib/campus-context";

type Producto = {
  id: number;
  nombre: string;
  precio: number;
  foto_url: string | null;
  stock: number;
  activo: boolean;
};

type SolicitudPropia = {
  id: number;
  producto_id: number;
  cantidad: number;
  estado: "Pendiente" | "Entregada" | "Rechazada";
  creado_en: string;
};

function clp(n: number): string {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

/**
 * Vitrina del catálogo de Merch: cualquier persona del campus ve los
 * productos con foto/precio/stock y pide comprar — RLS deja ver el
 * catálogo a todos, la solicitud no rebaja stock sola (la API recién lo
 * hace cuando el líder de Merch la marca "Entregada"). Gestionar el
 * catálogo en sí (crear productos, cargar stock, resolver solicitudes,
 * ver el informe de ingresos) vive en Mi equipo → área Merch.
 */
export default function MerchCatalogoPage() {
  const { campusActivo } = useCampus();
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [misSolicitudes, setMisSolicitudes] = useState<SolicitudPropia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [puedeGestionar, setPuedeGestionar] = useState(false);

  const cargar = useCallback(async () => {
    const [rProd, rMias, rPerfil] = await Promise.all([
      fetch(`/api/merch/productos?campus=${encodeURIComponent(campusActivo)}&activos=1`),
      fetch(`/api/merch/producto-solicitudes?campus=${encodeURIComponent(campusActivo)}&propias=1`),
      fetch("/api/perfil"),
    ]);
    const [jProd, jMias, jPerfil] = await Promise.all([rProd.json(), rMias.json(), rPerfil.json()]);
    if (jProd.ok) setProductos(jProd.data);
    if (jMias.ok) setMisSolicitudes(jMias.data);
    if (jPerfil.ok) {
      const p = jPerfil.data as { roles: string[]; areas: string[]; sirve: string[] };
      const esFin = p.roles.some((r) => ["Pastor principal", "Pastor de campus", "Pastor", "Ministro", "Administrador"].includes(r));
      setPuedeGestionar(esFin || p.areas.includes("Merch") || p.sirve.includes("Merch"));
    }
  }, [campusActivo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirSolicitud(p: Producto) {
    setSeleccionado(p);
    setCantidad(1);
    setNota("");
    setError(null);
  }

  async function confirmarSolicitud() {
    if (!seleccionado) return;
    setEnviando(true);
    setError(null);
    const res = await fetch("/api/merch/producto-solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus: campusActivo,
        producto_id: seleccionado.id,
        cantidad,
        nota: nota || undefined,
      }),
    });
    const json = await res.json();
    setEnviando(false);
    if (!json.ok) { setError(json.error); return; }
    setSeleccionado(null);
    await cargar();
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem", margin: 0 }}>Catálogo Merch</h1>
        {puedeGestionar && (
          <Link href="/equipos" className="muted" style={{ fontSize: "0.82rem", textDecoration: "none", marginLeft: "auto" }}>
            Gestionar ›
          </Link>
        )}
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>{campusActivo}</p>

      {error && <p className="aviso">{error}</p>}

      {productos === null && <p className="muted">Cargando…</p>}
      {productos?.length === 0 && <p className="muted">Todavía no hay productos cargados en el catálogo.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {productos?.map((p) => {
          const agotado = p.stock <= 0;
          const pocoStock = !agotado && p.stock <= 3;
          return (
            <button
              key={p.id}
              type="button"
              className="tarjeta"
              onClick={() => !agotado && abrirSolicitud(p)}
              disabled={agotado}
              style={{
                display: "flex", flexDirection: "column", gap: 6, padding: 10, textAlign: "left",
                cursor: agotado ? "default" : "pointer", opacity: agotado ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  width: "100%", aspectRatio: "1", borderRadius: 8, overflow: "hidden",
                  background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {p.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="muted" style={{ fontSize: "0.75rem" }}>Sin foto</span>
                )}
              </div>
              <b style={{ fontSize: "0.88rem", lineHeight: 1.2 }}>{p.nombre}</b>
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--gold)" }}>{clp(p.precio)}</span>
              {agotado ? (
                <span className="chip" style={{ fontSize: "0.7rem", padding: "2px 8px", minHeight: "auto", alignSelf: "flex-start" }}>Agotado</span>
              ) : pocoStock ? (
                <span className="chip" style={{ fontSize: "0.7rem", padding: "2px 8px", minHeight: "auto", alignSelf: "flex-start" }}>
                  Quedan {p.stock}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: "0.75rem" }}>Stock: {p.stock}</span>
              )}
            </button>
          );
        })}
      </div>

      {misSolicitudes && misSolicitudes.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 8 }}>Mis solicitudes</p>
          {misSolicitudes.map((s) => {
            const prod = productos?.find((p) => p.id === s.producto_id);
            return (
              <div key={s.id} className="eco-row">
                <div>
                  <b>{prod?.nombre ?? "Producto"}</b>
                  <small>Cantidad: {s.cantidad}</small>
                </div>
                <span className={`eco-badge ${s.estado === "Entregada" ? "ok" : s.estado === "Rechazada" ? "bad" : "warn"}`}>
                  {s.estado}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {seleccionado && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
            alignItems: "flex-end", justifyContent: "center", zIndex: 50,
          }}
          onClick={() => setSeleccionado(null)}
        >
          <div
            className="tarjeta stack"
            style={{ width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <b>{seleccionado.nombre}</b>
            <p className="muted" style={{ margin: 0 }}>{clp(seleccionado.precio)} · quedan {seleccionado.stock}</p>
            {error && <p className="aviso">{error}</p>}
            <div className="campo">
              <label>Cantidad</label>
              <input
                type="number" min={1} max={seleccionado.stock} value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Math.min(seleccionado.stock, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="campo">
              <label>Nota (opcional)</label>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: paso a buscarlo el domingo" />
            </div>
            <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
              Total: <b>{clp(seleccionado.precio * cantidad)}</b> — queda pendiente hasta que el líder de Merch confirme la entrega.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="boton-secundario" onClick={() => setSeleccionado(null)} disabled={enviando}>Cancelar</button>
              <button className="boton" onClick={confirmarSolicitud} disabled={enviando}>
                {enviando ? "Enviando…" : "Solicitar compra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
