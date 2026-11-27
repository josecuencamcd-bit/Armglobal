"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  fotos: string[] | null;
  stock: number;
};

/** Compatibilidad: productos creados antes de "fotos" solo tienen foto_url. */
function fotosDe(p: Producto): string[] {
  if (p.fotos && p.fotos.length > 0) return p.fotos;
  return p.foto_url ? [p.foto_url] : [];
}

function clp(n: number): string {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

/** Comprime la foto del comprobante a jpeg liviano antes de mandarla (mismo
 * tope de 8MB base64 que acepta subirFotoJpeg, pero la achicamos para que
 * suba rápido desde el celular de alguien sin la app). */
async function comprobanteADataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxLado = 1000;
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.75);
}

function VitrinaPublica() {
  const params = useSearchParams();
  const campus = params.get("campus");

  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [datosTransferencia, setDatosTransferencia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [metodoPago, setMetodoPago] = useState<"Transferencia" | "Presencial">("Transferencia");
  const [comprobante, setComprobante] = useState<string | undefined>(undefined);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!campus) return;
    fetch(`/api/vitrina/productos?campus=${encodeURIComponent(campus)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) { setError(json.error); return; }
        setProductos(json.data.productos);
        setDatosTransferencia(json.data.datosTransferencia);
      })
      .catch(() => setError("No se pudo cargar el catálogo."));
  }, [campus]);

  function abrir(p: Producto) {
    setSeleccionado(p);
    setCantidad(1);
    setNombre("");
    setContacto("");
    setMetodoPago("Transferencia");
    setComprobante(undefined);
    setNota("");
    setEnviado(false);
    setError(null);
  }

  async function enviar() {
    if (!seleccionado || !campus) return;
    if (!nombre.trim() || !contacto.trim()) { setError("Deja tu nombre y un contacto."); return; }
    setEnviando(true);
    setError(null);
    const res = await fetch("/api/vitrina/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus, producto_id: seleccionado.id, cantidad, nombre, contacto,
        metodo_pago: metodoPago, comprobante, nota: nota || undefined,
      }),
    });
    const json = await res.json();
    setEnviando(false);
    if (!json.ok) { setError(json.error); return; }
    setEnviado(true);
  }

  if (!campus) {
    return (
      <div className="contenedor" style={{ paddingTop: 40, textAlign: "center" }}>
        <p className="aviso">Este link no indica el campus. Pide el link correcto a quien te lo compartió.</p>
      </div>
    );
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: 560, margin: "0 auto" }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem", margin: "0 0 2px" }}>Catálogo Merch</h1>
      <p className="muted" style={{ marginTop: 0 }}>{campus} · ARM Global</p>

      {error && !seleccionado && <p className="aviso">{error}</p>}
      {productos === null && !error && <p className="muted">Cargando…</p>}
      {productos?.length === 0 && <p className="muted">Todavía no hay productos cargados en el catálogo.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {productos?.map((p) => {
          const agotado = p.stock <= 0;
          return (
            <button
              key={p.id} type="button" className="tarjeta" onClick={() => !agotado && abrir(p)} disabled={agotado}
              style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, textAlign: "left", cursor: agotado ? "default" : "pointer", opacity: agotado ? 0.55 : 1 }}
            >
              <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {fotosDe(p)[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotosDe(p)[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="muted" style={{ fontSize: "0.75rem" }}>Sin foto</span>
                )}
              </div>
              <b style={{ fontSize: "0.88rem", lineHeight: 1.2 }}>{p.nombre}</b>
              {p.descripcion && <span className="muted" style={{ fontSize: "0.76rem", lineHeight: 1.25 }}>{p.descripcion}</span>}
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--gold)" }}>{clp(p.precio)}</span>
              {agotado ? (
                <span className="chip" style={{ fontSize: "0.7rem", padding: "2px 8px", minHeight: "auto", alignSelf: "flex-start" }}>Agotado</span>
              ) : p.stock <= 3 ? (
                <span className="chip" style={{ fontSize: "0.7rem", padding: "2px 8px", minHeight: "auto", alignSelf: "flex-start" }}>Quedan {p.stock}</span>
              ) : (
                <span className="muted" style={{ fontSize: "0.75rem" }}>Stock: {p.stock}</span>
              )}
            </button>
          );
        })}
      </div>

      {seleccionado && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={() => setSeleccionado(null)}>
          <div className="tarjeta stack" style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: "16px 16px 0 0", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            {enviado ? (
              <>
                <b>¡Listo, {nombre.split(" ")[0]}!</b>
                <p className="muted" style={{ margin: 0 }}>
                  Tu solicitud de <b>{seleccionado.nombre}</b> × {cantidad} quedó registrada. Te van a contactar a {contacto} para coordinar la entrega.
                </p>
                <button className="boton" onClick={() => setSeleccionado(null)}>Volver al catálogo</button>
              </>
            ) : (
              <>
                <b>{seleccionado.nombre}</b>
                {fotosDe(seleccionado).length > 0 && (
                  <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                    {fotosDe(seleccionado).map((foto, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={foto} alt="" style={{ width: 90, height: 90, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    ))}
                  </div>
                )}
                <p className="muted" style={{ margin: 0 }}>{clp(seleccionado.precio)} · quedan {seleccionado.stock}</p>
                {error && <p className="aviso">{error}</p>}
                <div className="campo">
                  <label>Tu nombre</label>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
                </div>
                <div className="campo">
                  <label>Teléfono o correo</label>
                  <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Para avisarte cuando esté listo" />
                </div>
                <div className="campo">
                  <label>Cantidad</label>
                  <input type="number" min={1} max={seleccionado.stock} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(seleccionado.stock, Number(e.target.value) || 1)))} />
                </div>
                <div className="campo">
                  <label>Método de pago</label>
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as "Transferencia" | "Presencial")}>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Presencial">Presencial (pago al retirar)</option>
                  </select>
                </div>
                {metodoPago === "Transferencia" && (
                  <div className="tarjeta" style={{ padding: 10, fontSize: "0.82rem" }}>
                    {datosTransferencia ? (
                      <>
                        <p className="muted" style={{ margin: "0 0 6px" }}>Datos para transferir:</p>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{datosTransferencia}</p>
                      </>
                    ) : (
                      <p className="muted" style={{ margin: 0 }}>Te van a compartir los datos de la cuenta al confirmar tu solicitud.</p>
                    )}
                    <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.78rem", marginTop: 8, cursor: "pointer" }}>
                      {comprobante ? "Comprobante adjunto ✓" : "Adjuntar comprobante (opcional)"}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setComprobante(await comprobanteADataUrl(f)); e.target.value = ""; }} />
                    </label>
                  </div>
                )}
                <div className="campo">
                  <label>Nota (opcional)</label>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: paso a buscarlo el domingo" />
                </div>
                <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>Total: <b>{clp(seleccionado.precio * cantidad)}</b></p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="boton-secundario" onClick={() => setSeleccionado(null)} disabled={enviando}>Cancelar</button>
                  <button className="boton" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Solicitar compra"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VitrinaPage() {
  return (
    <Suspense fallback={<div className="contenedor" style={{ paddingTop: 40 }}><p className="muted">Cargando…</p></div>}>
      <VitrinaPublica />
    </Suspense>
  );
}
