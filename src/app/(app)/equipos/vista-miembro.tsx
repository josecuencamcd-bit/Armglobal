"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { proximaFecha, METODOS_FONDO } from "@/lib/sesiones";
import { SERVICIO_DE_ENCUENTRO } from "@/lib/disponibilidad";

type TuServicio = { servicio: string; fecha: string; area: string; puesto: string };

type IntegranteMini = {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  nacimiento: string | null;
  anos_iglesia: number | null;
  anos_servicio: number | null;
  rol_servicio: string | null;
  profesion: string | null;
  talla_polera: string | null;
  talla_poleron: string | null;
  foto_url: string | null;
};

function fechaCL(iso: string | null) {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Reduce la imagen a un cuadrado chico y la comprime a JPEG hasta entrar
 * en el mismo tope de 45000 caracteres que acepta /api/integrantes/[id]/foto
 * (igual que la foto de "Mi perfil"). */
async function fotoADataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const lado = 320;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  const escala = Math.max(lado / bitmap.width, lado / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (lado - w) / 2, (lado - h) / 2, w, h);
  for (const calidad of [0.8, 0.6, 0.4, 0.25]) {
    const url = canvas.toDataURL("image/jpeg", calidad);
    if (url.length <= 45_000) return url;
  }
  throw new Error("La foto es muy pesada. Prueba con otra.");
}

function Avatar({ nombre, foto, size = 40 }: { nombre: string; foto: string | null; size?: number }) {
  return foto ? (
    <img src={foto} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "var(--gold-grad)", color: "var(--accent-ink)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.38,
      }}
    >
      {iniciales(nombre)}
    </div>
  );
}

type ProductoMerch = { id: number; nombre: string; precio: number; stock: number };

function clp(n: number): string {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

/**
 * Para quien SIRVE en Merch sin liderarlo: registrar una venta presencial
 * (descuenta stock y queda en el informe de ingresos de la líder) sin
 * exponer el resto del panel de gestión (fotos, precio, catálogo, vitrina).
 * La RLS/RPC ya permite esto a cualquiera que figure en perfil.sirve.
 */
function VentaMerch({ campus }: { campus: string }) {
  const [productos, setProductos] = useState<ProductoMerch[] | null>(null);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState<"Efectivo" | "Transferencia" | "Tarjeta">("Efectivo");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/merch/productos?campus=${encodeURIComponent(campus)}&activos=1`);
    const json = await res.json();
    if (json.ok) {
      setProductos(json.data);
      if (!productoId && json.data.length > 0) setProductoId(json.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus]);

  useEffect(() => { cargar(); }, [cargar]);

  async function registrarVenta() {
    if (!productoId) return;
    setEnviando(true);
    setError(null);
    setMensaje(null);
    const res = await fetch(`/api/merch/productos/${productoId}/movimiento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_mov: "Venta", cantidad, metodo_pago: metodoPago }),
    });
    const json = await res.json();
    setEnviando(false);
    if (!json.ok) { setError(json.error); return; }
    setMensaje("Venta registrada.");
    setCantidad(1);
    await cargar();
  }

  const elegido = productos?.find((p) => p.id === productoId);

  return (
    <div className="tarjeta" style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>Registrar venta de Merch</p>
      {productos === null && <p className="muted" style={{ fontSize: "0.82rem" }}>Cargando catálogo…</p>}
      {productos?.length === 0 && <p className="muted" style={{ fontSize: "0.82rem" }}>No hay productos en el catálogo todavía.</p>}
      {error && <p className="aviso">{error}</p>}
      {mensaje && <p className="muted" style={{ fontSize: "0.82rem" }}>{mensaje}</p>}
      {productos && productos.length > 0 && (
        <>
          <div className="campo">
            <label>Producto</label>
            <select value={productoId ?? ""} onChange={(e) => setProductoId(Number(e.target.value))}>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} — {clp(p.precio)} (stock {p.stock})</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="number" min={1} max={elegido?.stock ?? 1} value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 70 }}
            />
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as typeof metodoPago)} style={{ width: "auto", fontSize: "0.86rem" }}>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Tarjeta">Tarjeta</option>
            </select>
            <button
              type="button" className="boton" style={{ width: "auto", padding: "8px 14px" }}
              disabled={enviando || !elegido || elegido.stock < 1} onClick={registrarVenta}
            >
              {enviando ? "Guardando…" : "Registrar venta"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Mismo achique que el comprobante de Merch — jpeg liviano, no el base64
 * de 45000 que usan las fotos de perfil/producto. */
async function comprobanteADataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxLado = 1000;
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.75);
}

/**
 * "Aportar al fondo de equipo": cualquiera que SIRVA en un área (lidere o
 * no) puede dejar registrado un aporte para los gastos internos de ESE
 * equipo — distinto del aporte de ofrenda/diezmo de los encuentros. Se usa
 * tanto acá (quien no lidera nada) como en la vista de solo lectura de
 * /equipos (quien lidera OTRA área y está mirando esta de paso).
 */
export function AporteEquipo({ campus, area }: { campus: string; area: string }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<(typeof METODOS_FONDO)[number]>("Efectivo");
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    const montoNum = Math.floor(Number(monto));
    if (!montoNum || montoNum <= 0) { setError("Escribe un monto válido."); return; }
    setEnviando(true);
    setError(null);
    setMensaje(null);
    const res = await fetch("/api/fondos/aporte-voluntario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus, area, monto: montoNum, metodo, descripcion: descripcion || undefined, foto }),
    });
    const json = await res.json();
    setEnviando(false);
    if (!json.ok) { setError(json.error); return; }
    setMensaje("Aporte registrado — tu líder ya fue avisada.");
    setMonto("");
    setDescripcion("");
    setFoto(undefined);
  }

  if (!abierto) {
    return (
      <button type="button" className="boton-secundario" style={{ width: "auto", padding: "6px 10px", fontSize: "0.78rem", marginTop: 8 }} onClick={() => setAbierto(true)}>
        + Aportar al fondo de {area}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.86rem" }}>Aportar al fondo de {area}</p>
      {error && <p className="aviso">{error}</p>}
      {mensaje && <p className="muted" style={{ fontSize: "0.82rem" }}>{mensaje}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="number" min={1} placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} style={{ width: 110 }} />
        <select value={metodo} onChange={(e) => setMetodo(e.target.value as typeof metodo)} style={{ width: "auto" }}>
          {METODOS_FONDO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <input type="text" placeholder="Nota (opcional)" maxLength={120} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
        ) : (
          <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.76rem", padding: "6px 10px", cursor: "pointer" }}>
            Cámara
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFoto(await comprobanteADataUrl(f)); e.target.value = ""; }} />
          </label>
        )}
        <label className="boton-secundario" style={{ display: "inline-block", width: "auto", fontSize: "0.76rem", padding: "6px 10px", cursor: "pointer" }}>
          Galería
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFoto(await comprobanteADataUrl(f)); e.target.value = ""; }} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="boton" style={{ width: "auto", padding: "8px 14px" }} disabled={enviando} onClick={enviar}>
          {enviando ? "Guardando…" : "Registrar aporte"}
        </button>
        <button type="button" className="boton-secundario" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setAbierto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function PerfilModal({ persona, onCerrar, onActualizado }: { persona: IntegranteMini; onCerrar: () => void; onActualizado: (p: IntegranteMini) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subirFoto(file: File) {
    setSubiendo(true);
    setError(null);
    try {
      const foto_url = await fotoADataUrl(file);
      const res = await fetch(`/api/integrantes/${persona.id}/foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto_url }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      onActualizado(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto() {
    setSubiendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrantes/${persona.id}/foto`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      onActualizado(json.data);
    } finally {
      setSubiendo(false);
    }
  }

  const cumple = fechaCL(persona.nacimiento);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onCerrar}
    >
      <div className="tarjeta" style={{ width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <Avatar nombre={persona.nombre} foto={persona.foto_url} size={64} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem" }}>{persona.nombre}</p>
            {persona.rol_servicio && <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>{persona.rol_servicio}</p>}
          </div>
        </div>

        <label className="boton-secundario" style={{ display: "inline-block", fontSize: "0.8rem", cursor: "pointer", marginRight: 8 }}>
          {subiendo ? "Subiendo…" : persona.foto_url ? "Cambiar foto" : "Agregar foto"}
          <input
            type="file"
            accept="image/*"
            disabled={subiendo}
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }}
          />
        </label>
        {persona.foto_url && (
          <button type="button" className="boton-peligro" style={{ width: "auto", fontSize: "0.8rem" }} disabled={subiendo} onClick={quitarFoto}>
            Quitar foto
          </button>
        )}
        {error && <p className="aviso" style={{ marginTop: 8 }}>{error}</p>}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, fontSize: "0.86rem" }}>
          {persona.telefono && <p style={{ margin: 0 }}><span className="muted">Teléfono: </span>{persona.telefono}</p>}
          {persona.correo && <p style={{ margin: 0 }}><span className="muted">Correo: </span>{persona.correo}</p>}
          {cumple && <p style={{ margin: 0 }}><span className="muted">Cumpleaños: </span>{cumple}</p>}
          {persona.profesion && <p style={{ margin: 0 }}><span className="muted">Profesión: </span>{persona.profesion}</p>}
          {persona.anos_iglesia != null && <p style={{ margin: 0 }}><span className="muted">Años en la iglesia: </span>{persona.anos_iglesia}</p>}
          {persona.anos_servicio != null && <p style={{ margin: 0 }}><span className="muted">Años sirviendo: </span>{persona.anos_servicio}</p>}
          {(persona.talla_polera || persona.talla_poleron) && (
            <p style={{ margin: 0 }}><span className="muted">Talla polera/polerón: </span>{persona.talla_polera ?? "—"} / {persona.talla_poleron ?? "—"}</p>
          )}
        </div>

        <button type="button" className="boton-secundario" style={{ marginTop: 18 }} onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

/**
 * Vista de solo lectura de "Mi equipo" para quien SIRVE o FORMA PARTE de
 * uno o más equipos (perfil.areas/sirve) pero no los lidera: por cada
 * equipo del que forma parte, lista a sus compañeros (sin botones de
 * gestión) — tocar a alguien abre su perfil, con foto si tiene y la
 * opción de agregarle una.
 */
export default function VistaMiembro({ campus, areas }: { campus: string; areas: string[] }) {
  const [porArea, setPorArea] = useState<Record<string, IntegranteMini[]> | null>(null);
  const [lideresPorArea, setLideresPorArea] = useState<Record<string, string[]>>({});
  const [misServicios, setMisServicios] = useState<TuServicio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<{ area: string; persona: IntegranteMini } | null>(null);

  const cargar = useCallback(async () => {
    const [resultados, resultadosLideres] = await Promise.all([
      Promise.all(
        areas.map(async (a) => {
          const res = await fetch(`/api/integrantes?campus=${encodeURIComponent(campus)}&area=${encodeURIComponent(a)}`);
          const json = await res.json();
          return [a, json.ok ? (json.data as IntegranteMini[]) : []] as const;
        })
      ),
      Promise.all(
        areas.map(async (a) => {
          const res = await fetch(`/api/integrantes/lideres-equipo?campus=${encodeURIComponent(campus)}&area=${encodeURIComponent(a)}`);
          const json = await res.json();
          return [a, json.ok ? (json.data as string[]) : []] as const;
        })
      ),
    ]);
    setPorArea(Object.fromEntries(resultados));
    setLideresPorArea(Object.fromEntries(resultadosLideres));
    setError(null);
  }, [campus, areas]);

  // "Tu próximo servicio": de las 3 fichas de la semana (Jueves/Domingo AM/
  // Domingo PM), busca filas donde el nombre coincida con el propio —
  // fichas_servicio es de lectura abierta, así que no hace falta una ruta
  // nueva; solo cruzar con el nombre que ya trae /api/perfil.
  useEffect(() => {
    fetch("/api/perfil").then((r) => r.json()).then(async (jPerfil) => {
      if (!jPerfil.ok) return;
      const miNombre = (jPerfil.data.nombre as string | undefined)?.trim().toLowerCase();
      if (!miNombre) return;
      const resultados = await Promise.all(
        Object.entries(SERVICIO_DE_ENCUENTRO).map(async ([encuentro, servicio]) => {
          const fecha = proximaFecha(encuentro);
          const res = await fetch(`/api/fichas-servicio?servicio=${encodeURIComponent(servicio)}&fecha=${fecha}`);
          const json = await res.json();
          if (!json.ok) return [];
          return (json.data as { servicio: string; fecha: string; area: string; puesto: string; nombre: string | null }[])
            .filter((f) => f.nombre?.trim().toLowerCase() === miNombre)
            .map((f) => ({ servicio: f.servicio, fecha: f.fecha, area: f.area, puesto: f.puesto }));
        })
      );
      setMisServicios(resultados.flat());
    });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!porArea) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem", margin: "0 0 4px" }}>Mi equipo</h1>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.82rem" }}>Campus {campus}</p>
      {error && <p className="aviso">{error}</p>}

      <Link href="/merch" className="tarjeta eco-row" style={{ textDecoration: "none", color: "inherit", marginBottom: 14 }}>
        <div>
          <b>Catálogo Merch</b>
          <small>Mira qué hay disponible y pide comprar.</small>
        </div>
        <span className="muted">Ver →</span>
      </Link>

      {misServicios.length > 0 && (
        <div className="tarjeta" style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Tu próximo servicio</p>
          {misServicios.map((s, i) => (
            <p key={i} style={{ margin: "0 0 4px", fontSize: "0.86rem" }}>
              <b>{s.servicio}</b> ({new Date(`${s.fecha}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}) · {s.area} · {s.puesto}
            </p>
          ))}
        </div>
      )}

      {areas.includes("Merch") && <VentaMerch campus={campus} />}

      {areas.map((area) => {
        const lideres = new Set((lideresPorArea[area] ?? []).map((n) => n.trim().toLowerCase()));
        return (
          <div key={area} className="tarjeta" style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700 }}>{area}</p>
            {(porArea[area] ?? []).length === 0 && <p className="muted" style={{ fontSize: "0.82rem" }}>Sin compañeros cargados todavía.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(porArea[area] ?? []).map((p) => {
                const esLider = lideres.has(p.nombre.trim().toLowerCase());
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSeleccionado({ area, persona: p })}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      padding: "8px 4px", background: "none", border: "none", cursor: "pointer", color: "inherit",
                    }}
                  >
                    <Avatar nombre={p.nombre} foto={p.foto_url} />
                    <span style={{ fontWeight: esLider ? 700 : 400 }}>{p.nombre}</span>
                    {esLider && (
                      <span className="chip" style={{ fontSize: "0.68rem", padding: "2px 8px", minHeight: "auto" }}>Líder</span>
                    )}
                  </button>
                );
              })}
            </div>
            <AporteEquipo campus={campus} area={area} />
          </div>
        );
      })}

      {seleccionado && (
        <PerfilModal
          persona={seleccionado.persona}
          onCerrar={() => setSeleccionado(null)}
          onActualizado={(actualizado) => {
            setPorArea((prev) => {
              if (!prev) return prev;
              const lista = (prev[seleccionado.area] ?? []).map((p) => (p.id === actualizado.id ? actualizado : p));
              return { ...prev, [seleccionado.area]: lista };
            });
            setSeleccionado({ area: seleccionado.area, persona: actualizado });
          }}
        />
      )}
    </div>
  );
}
