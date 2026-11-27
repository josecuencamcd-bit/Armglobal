"use client";

import { useCallback, useEffect, useState } from "react";

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  fotos: string[] | null;
  stock: number;
  activo: boolean;
};

const MAX_FOTOS = 6;
type MetodoPago = "Efectivo" | "Transferencia" | "Tarjeta";

/** Compatibilidad: productos creados antes de "fotos" solo tienen foto_url. */
function fotosDe(p: Producto): string[] {
  if (p.fotos && p.fotos.length > 0) return p.fotos;
  return p.foto_url ? [p.foto_url] : [];
}
type SolicitudProducto = {
  id: number;
  producto_id: number;
  solicitante: string;
  correo_solicitante: string | null;
  cantidad: number;
  estado: string;
  nota: string | null;
  metodo_pago: string | null;
  comprobante_url: string | null;
  creado_en: string;
};
type Informe = {
  stock: Producto[];
  masVendidos: { producto_id: number; nombre: string; unidades: number; ingresos: number; ventas: number }[];
  ingresosTotales: number;
  unidadesTotales: number;
  desde: string | null;
  hasta: string | null;
};

function clp(n: number): string {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function hace30DiasISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

/** Comprime la foto del producto a un cuadrado chico en JPEG, mismo patrón
 * que fotoPerfilADataUrl de page.tsx / vista-miembro.tsx, hasta entrar en
 * el tope de 45000 caracteres que acepta /api/merch/productos. */
async function fotoProductoADataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const lado = 480;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  const escala = Math.max(lado / bitmap.width, lado / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (lado - w) / 2, (lado - h) / 2, w, h);
  for (const calidad of [0.75, 0.6, 0.4, 0.25]) {
    const url = canvas.toDataURL("image/jpeg", calidad);
    if (url.length <= 45_000) return url;
  }
  throw new Error("La foto es muy pesada. Prueba con otra.");
}

/**
 * Panel de gestión del catálogo general de Merch (vitrina en /merch): crear
 * productos con foto/precio, cargar stock, registrar ventas directas,
 * resolver solicitudes de compra de la vitrina y ver el informe de
 * ingresos — solo tiene sentido dentro de "Mi equipo" cuando area ===
 * "Merch"; el padre ya se encarga de eso. RLS limita todo a área Merch o
 * Finanzas.
 */
export default function MerchCatalogo({ campus }: { campus: string }) {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudProducto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<number | string | null>(null);

  const [creando, setCreando] = useState(false);
  const [fotosNuevas, setFotosNuevas] = useState<string[]>([]);

  const [desde, setDesde] = useState(hace30DiasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [informe, setInforme] = useState<Informe | null>(null);
  const [cargandoInforme, setCargandoInforme] = useState(false);

  const [datosTransferencia, setDatosTransferencia] = useState("");
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const cargar = useCallback(async () => {
    const [rProd, rSol, rConfig] = await Promise.all([
      fetch(`/api/merch/productos?campus=${encodeURIComponent(campus)}`),
      fetch(`/api/merch/producto-solicitudes?campus=${encodeURIComponent(campus)}&estado=Pendiente`),
      fetch(`/api/merch/config?campus=${encodeURIComponent(campus)}`),
    ]);
    const [jProd, jSol, jConfig] = await Promise.all([rProd.json(), rSol.json(), rConfig.json()]);
    if (jProd.ok) setProductos(jProd.data);
    if (jSol.ok) setSolicitudes(jSol.data);
    if (jConfig.ok) setDatosTransferencia(jConfig.data.datos_transferencia ?? "");
  }, [campus]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const generarInforme = useCallback(async () => {
    setCargandoInforme(true);
    setError(null);
    const res = await fetch(`/api/merch/productos/informe?campus=${encodeURIComponent(campus)}&desde=${desde}&hasta=${hasta}`);
    const json = await res.json();
    setCargandoInforme(false);
    if (!json.ok) { setError(json.error); return; }
    setInforme(json.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, desde, hasta]);

  async function crearProducto(fd: FormData) {
    setCreando(true);
    setError(null);
    const res = await fetch("/api/merch/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        nombre: fd.get("nombre"),
        descripcion: (fd.get("descripcion") as string)?.trim() || undefined,
        precio: Number(fd.get("precio") || 0),
        stock: Number(fd.get("stock") || 0),
        fotos: fotosNuevas,
      }),
    });
    const json = await res.json();
    setCreando(false);
    if (!json.ok) { setError(json.error); return; }
    setFotosNuevas([]);
    (document.getElementById("form-nuevo-producto") as HTMLFormElement | null)?.reset();
    await cargar();
  }

  async function agregarFotoNueva(file: File) {
    if (fotosNuevas.length >= MAX_FOTOS) { setError(`Máximo ${MAX_FOTOS} fotos por producto.`); return; }
    const foto = await fotoProductoADataUrl(file);
    setFotosNuevas((prev) => [...prev, foto]);
  }

  async function agregarFotoProducto(id: number, fotosActuales: string[], file: File) {
    if (fotosActuales.length >= MAX_FOTOS) { setError(`Máximo ${MAX_FOTOS} fotos por producto.`); return; }
    setOcupado(`foto-${id}`);
    setError(null);
    try {
      const foto = await fotoProductoADataUrl(file);
      const res = await fetch(`/api/merch/productos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotos: [...fotosActuales, foto] }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setOcupado(null);
    }
  }

  async function quitarFotoProducto(id: number, fotosActuales: string[], index: number) {
    setOcupado(`foto-${id}`);
    setError(null);
    const res = await fetch(`/api/merch/productos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotos: fotosActuales.filter((_, i) => i !== index) }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function cambiarActivo(id: number, activo: boolean) {
    setOcupado(`activo-${id}`);
    const res = await fetch(`/api/merch/productos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function registrarMovimiento(id: number, tipo_mov: "Entrada" | "Venta", cantidad: number, metodoPago?: MetodoPago) {
    if (cantidad < 1) return;
    setOcupado(`mov-${id}`);
    setError(null);
    const res = await fetch(`/api/merch/productos/${id}/movimiento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tipo_mov === "Venta" ? { tipo_mov, cantidad, metodo_pago: metodoPago } : { tipo_mov, cantidad }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
    if (informe) await generarInforme();
  }

  async function resolverSolicitud(id: number, estado: "Entregada" | "Rechazada") {
    setOcupado(`sol-${id}`);
    setError(null);
    const res = await fetch(`/api/merch/producto-solicitudes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
    if (informe) await generarInforme();
  }

  async function guardarConfig() {
    setGuardandoConfig(true);
    setError(null);
    const res = await fetch("/api/merch/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, datos_transferencia: datosTransferencia.trim() || null }),
    });
    const json = await res.json();
    setGuardandoConfig(false);
    if (!json.ok) { setError(json.error); return; }
  }

  async function copiarLink() {
    const url = `${window.location.origin}/vitrina?campus=${encodeURIComponent(campus)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      window.prompt("Copia el link:", url);
    }
  }

  async function verComprobante(id: number) {
    const res = await fetch(`/api/merch/producto-solicitudes/${id}/foto`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    window.open(json.data.url, "_blank");
  }

  return (
    <div className="tarjeta stack" style={{ marginBottom: 16 }}>
      <span className="label">Catálogo (vitrina)</span>
      {error && <p className="aviso">{error}</p>}

      <div className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Compartir vitrina</p>
        <p style={{ margin: 0, fontSize: "0.82rem" }}>
          Cualquiera con este link ve el catálogo y pide comprar, sin necesitar cuenta en la app.
        </p>
        <button type="button" className="boton-secundario" style={{ width: "auto", padding: "8px 14px" }} onClick={copiarLink}>
          {linkCopiado ? "¡Copiado!" : "Copiar link para compartir"}
        </button>
        <div className="campo">
          <label>Datos de transferencia (se muestran cuando eligen pagar así)</label>
          <textarea
            value={datosTransferencia} onChange={(e) => setDatosTransferencia(e.target.value)}
            placeholder="Ej: Banco Estado, Cuenta Vista 123456789, RUT 11.111.111-1, Nombre Apellido"
            rows={3} style={{ resize: "vertical" }}
          />
        </div>
        <button type="button" className="boton-secundario" style={{ width: "auto", padding: "8px 14px" }} onClick={guardarConfig} disabled={guardandoConfig}>
          {guardandoConfig ? "Guardando…" : "Guardar datos"}
        </button>
      </div>

      {solicitudes && solicitudes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Solicitudes de compra pendientes</p>
          {solicitudes.map((s) => {
            const prod = productos?.find((p) => p.id === s.producto_id);
            return (
              <div key={s.id} className="eco-row">
                <div>
                  <b>{prod?.nombre ?? "Producto"}</b> × {s.cantidad}
                  <small>
                    {s.solicitante}{s.correo_solicitante ? ` · ${s.correo_solicitante}` : ""}
                    {s.metodo_pago ? ` · ${s.metodo_pago}` : ""}{s.nota ? ` · ${s.nota}` : ""}
                  </small>
                  {s.comprobante_url && (
                    <button type="button" className="muted" style={{ background: "none", border: "none", padding: 0, fontSize: "0.76rem", textDecoration: "underline", cursor: "pointer" }} onClick={() => verComprobante(s.id)}>
                      Ver comprobante
                    </button>
                  )}
                </div>
                <span style={{ display: "flex", gap: 6 }}>
                  <button
                    className="boton-secundario" style={{ width: "auto", padding: "6px 10px", fontSize: "0.78rem" }}
                    disabled={ocupado === `sol-${s.id}`} onClick={() => resolverSolicitud(s.id, "Rechazada")}
                  >
                    Rechazar
                  </button>
                  <button
                    className="boton" style={{ width: "auto", padding: "6px 10px", fontSize: "0.78rem" }}
                    disabled={ocupado === `sol-${s.id}`} onClick={() => resolverSolicitud(s.id, "Entregada")}
                  >
                    {ocupado === `sol-${s.id}` ? "…" : "Entregar"}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <form
        id="form-nuevo-producto"
        className="tarjeta"
        style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}
        action={(fd) => crearProducto(fd)}
      >
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Nuevo producto</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {fotosNuevas.map((foto, i) => (
            <div key={i} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover" }} />
              <button
                type="button" onClick={() => setFotosNuevas((prev) => prev.filter((_, j) => j !== i))}
                style={{
                  position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                  background: "var(--ink)", color: "var(--fondo)", border: "none", cursor: "pointer", fontSize: "0.7rem", lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
          {fotosNuevas.length === 0 && <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--surface-2)" }} />}
          {fotosNuevas.length < MAX_FOTOS && (
            <>
              <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.8rem", cursor: "pointer" }}>
                Tomar foto
                <input
                  type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await agregarFotoNueva(f); e.target.value = ""; }}
                />
              </label>
              <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.8rem", cursor: "pointer" }}>
                Galería
                <input
                  type="file" accept="image/*" style={{ display: "none" }}
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) await agregarFotoNueva(f); e.target.value = ""; }}
                />
              </label>
            </>
          )}
        </div>
        <div className="campo">
          <label>Nombre</label>
          <input name="nombre" placeholder="Ej: Libro Un Nuevo Tú" required maxLength={80} />
        </div>
        <div className="campo">
          <label>Descripción (opcional)</label>
          <input name="descripcion" placeholder="Ej: Tapa blanda, 180 páginas" maxLength={200} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="campo" style={{ flex: 1 }}>
            <label>Precio</label>
            <input name="precio" type="number" min={0} step={1} defaultValue={0} required />
          </div>
          <div className="campo" style={{ flex: 1 }}>
            <label>Stock inicial</label>
            <input name="stock" type="number" min={0} step={1} defaultValue={0} />
          </div>
        </div>
        <button className="boton" type="submit" disabled={creando}>{creando ? "Guardando…" : "Agregar al catálogo"}</button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {productos?.map((p) => (
          <ProductoFila
            key={p.id}
            producto={p}
            ocupado={ocupado}
            onAgregarFoto={(f) => agregarFotoProducto(p.id, fotosDe(p), f)}
            onQuitarFoto={(i) => quitarFotoProducto(p.id, fotosDe(p), i)}
            onActivo={(v) => cambiarActivo(p.id, v)}
            onMovimiento={(tipo, cant, metodo) => registrarMovimiento(p.id, tipo, cant, metodo)}
          />
        ))}
        {productos?.length === 0 && <p className="muted">Todavía no hay productos en el catálogo.</p>}
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.8rem" }}>Informe de ingresos</p>
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
            type="button" className="boton-secundario" style={{ width: "auto", padding: "0 14px", height: 44 }}
            onClick={generarInforme} disabled={cargandoInforme}
          >
            {cargandoInforme ? "Generando…" : "Generar informe"}
          </button>
        </div>

        {informe && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
              <b>{clp(informe.ingresosTotales)}</b> en ingresos · <b>{informe.unidadesTotales}</b> unidades vendidas entre {informe.desde} y {informe.hasta}
            </p>
            {informe.masVendidos.length === 0 && <p className="muted">Sin ventas en ese rango.</p>}
            {informe.masVendidos.map((v) => (
              <div key={v.producto_id} className="eco-row">
                <div>
                  <b>{v.nombre}</b>
                  <small>{v.ventas} {v.ventas === 1 ? "venta" : "ventas"}</small>
                </div>
                <span className="eco-badge ok">{v.unidades} un. · {clp(v.ingresos)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductoFila({
  producto, ocupado, onAgregarFoto, onQuitarFoto, onActivo, onMovimiento,
}: {
  producto: Producto;
  ocupado: number | string | null;
  onAgregarFoto: (file: File) => void;
  onQuitarFoto: (index: number) => void;
  onActivo: (v: boolean) => void;
  onMovimiento: (tipo: "Entrada" | "Venta", cantidad: number, metodoPago?: MetodoPago) => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("Efectivo");
  const subiendoFoto = ocupado === `foto-${producto.id}`;
  const cambiandoActivo = ocupado === `activo-${producto.id}`;
  const moviendo = ocupado === `mov-${producto.id}`;
  const fotos = fotosDe(producto);

  return (
    <div className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <b>{producto.nombre}</b>{!producto.activo && <span className="muted"> · oculto de la vitrina</span>}
          <div className="muted" style={{ fontSize: "0.78rem" }}>{clp(producto.precio)} · stock {producto.stock}</div>
        </div>
        <button
          type="button" className="boton-secundario" style={{ width: "auto", padding: "6px 10px", fontSize: "0.76rem" }}
          disabled={cambiandoActivo} onClick={() => onActivo(!producto.activo)}
        >
          {producto.activo ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {fotos.map((foto, i) => (
          <div key={i} style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
            <button
              type="button" disabled={subiendoFoto} onClick={() => onQuitarFoto(i)}
              style={{
                position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
                background: "var(--ink)", color: "var(--fondo)", border: "none", cursor: "pointer", fontSize: "0.65rem", lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {fotos.length === 0 && <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface-2)" }} />}
        {fotos.length < MAX_FOTOS && (
          <>
            <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.76rem", padding: "6px 10px", cursor: "pointer" }}>
              {subiendoFoto ? "…" : "Cámara"}
              <input
                type="file" accept="image/*" capture="environment" disabled={subiendoFoto} style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onAgregarFoto(f); e.target.value = ""; }}
              />
            </label>
            <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.76rem", padding: "6px 10px", cursor: "pointer" }}>
              {subiendoFoto ? "…" : "Galería"}
              <input
                type="file" accept="image/*" disabled={subiendoFoto} style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onAgregarFoto(f); e.target.value = ""; }}
              />
            </label>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="number" min={1} value={cantidad}
          onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
          style={{ width: 70 }}
        />
        <button
          type="button" className="boton-secundario" style={{ width: "auto", padding: "6px 10px", fontSize: "0.76rem" }}
          disabled={moviendo} onClick={() => onMovimiento("Entrada", cantidad)}
        >
          + Cargar stock
        </button>
        <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)} style={{ width: "auto", fontSize: "0.76rem", padding: "6px 8px" }}>
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
        </select>
        <button
          type="button" className="boton-secundario" style={{ width: "auto", padding: "6px 10px", fontSize: "0.76rem" }}
          disabled={moviendo} onClick={() => onMovimiento("Venta", cantidad, metodoPago)}
        >
          Registrar venta
        </button>
      </div>
    </div>
  );
}
