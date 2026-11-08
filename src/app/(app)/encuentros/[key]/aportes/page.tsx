"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CATEGORIAS_ENCUENTRO, METODOS, hoy } from "@/lib/sesiones";
import ModalCompartir from "@/components/ModalCompartir";

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
 *
 * Mismo candado que /encuentros/[key]: el mismo día del encuentro se puede
 * agregar/borrar aportes libremente; pasado ese día hace falta una
 * autorización vigente (Pastor da el Ok, Soporte da el paso final — ver
 * /api/autorizaciones), igual que RLS ya lo exige del lado del servidor
 * (aportes_insert/aportes_delete).
 */
export default function AportesEncuentroPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_ENCUENTRO[0]);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);

  const [autorizado, setAutorizado] = useState(false);
  const [solicitudPendiente, setSolicitudPendiente] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviandoMotivo, setEnviandoMotivo] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/sesiones/${key}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setEstado(json.data);
    setError(null);
  }, [key]);

  const cargarAutorizacion = useCallback(async () => {
    const [rp, ra] = await Promise.all([fetch("/api/perfil"), fetch(`/api/autorizaciones?sesion_key=${encodeURIComponent(decodeURIComponent(key))}`)]);
    const [jp, ja] = await Promise.all([rp.json(), ra.json()]);
    if (!jp.ok || !ja.ok) return;
    const mias = (ja.data as { correo: string; estado: string; vence: string | null }[])
      .filter((a) => a.correo === jp.data.correo);
    setAutorizado(mias.some((a) => a.estado === "Autorizada" && a.vence && new Date(a.vence) > new Date()));
    setSolicitudPendiente(mias.some((a) => a.estado === "Pendiente Pastor" || a.estado === "Pendiente Admin"));
  }, [key]);

  useEffect(() => {
    cargar();
    cargarAutorizacion();
  }, [cargar, cargarAutorizacion]);

  async function pedirAutorizacion() {
    if (!motivo.trim()) { setError("Cuéntanos el motivo para pedir autorización."); return; }
    setEnviandoMotivo(true);
    try {
      const [c, e, ev, f] = decodeURIComponent(key).split("|");
      const res = await fetch("/api/autorizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campus: c, encuentro: e, evento: ev, fecha: f, motivo: motivo.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!json || !json.ok) { setError(json?.error || "No se pudo enviar la solicitud. Intenta de nuevo."); return; }
      setPidiendo(false);
      setMotivo("");
      setError(null);
      await cargarAutorizacion();
    } catch {
      setError("No se pudo enviar la solicitud — revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviandoMotivo(false);
    }
  }

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
  const esHoy = fecha === hoy();
  const bloqueado = !esHoy && !autorizado;
  const aportes = estado?.aportes ?? [];
  const porCategoria = CATEGORIAS_ENCUENTRO.map((c) => ({ categoria: c, total: aportes.filter((a) => a.categoria === c).reduce((s, a) => s + a.monto, 0) }));
  const porMetodo = METODOS.map((m) => ({ metodo: m, total: aportes.filter((a) => a.metodo === m).reduce((s, a) => s + a.monto, 0) }));
  const total = aportes.reduce((s, a) => s + a.monto, 0);

  /** Mismo texto que antes armaba compartir() — ahora se pasa al modal
   * ModalCompartir, que replica la ventana de la app vieja (mensaje
   * editable + Cerrar/Copiar mensaje + PDF/Excel/correo). */
  function textoReporte() {
    const L: string[] = [];
    L.push(`Reporte de Aportes · Campus ${campus}`, "");
    L.push(`*Encuentro:* ${encuentro}`);
    L.push(`*Fecha:* ${fechaCL(fecha)}`);
    L.push(`*Responsable:* ${estado?.responsable ?? ""}`);
    L.push("", "*Formas de Sembrar*");
    porCategoria.forEach((c) => L.push(`- ${c.categoria} 🟰 ${peso(c.total)}`));
    L.push("", "*Total De Siembra*");
    porMetodo.forEach((m) => L.push(`- ${m.metodo} 🟰 ${peso(m.total)}`));
    L.push("", `*Total* 🟰 ${peso(total)}`);
    if (aportes.length > 0) {
      L.push("", "*Detalle*");
      aportes.forEach((a) => L.push(`- ${a.nombre}: ${peso(a.monto)}  ${a.categoria}`));
    }
    return L.join("\n");
  }

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
      {!esHoy && autorizado && (
        <p className="ok">Tienes autorización vigente para modificar los aportes de este encuentro.</p>
      )}
      {!esHoy && !autorizado && !solicitudPendiente && (
        <p className="aviso">Este encuentro es de un día anterior. Pide autorización para modificar sus aportes.</p>
      )}
      {!esHoy && !autorizado && solicitudPendiente && (
        <p className="aviso">Ya pediste autorización — esperando que el Pastor o Soporte la aprueben.</p>
      )}

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

      {!bloqueado && (
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
              {CATEGORIAS_ENCUENTRO.map((c) => (
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
            {!bloqueado && (
              <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => borrar(a.id)}>✕</button>
            )}
          </span>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          className="boton"
          style={{ flex: 1, background: "var(--ok)" }}
          onClick={() => setCompartiendo(true)}
        >
          Compartir reporte
        </button>
        {bloqueado && !solicitudPendiente && (
          <button
            type="button"
            className="boton-secundario"
            style={{ flex: 1, width: "auto" }}
            onClick={() => setPidiendo(true)}
          >
            Modificar registro
          </button>
        )}
      </div>

      {pidiendo && (
        <div className="tarjeta">
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Pedir autorización para modificar</p>
          <div className="campo" style={{ marginBottom: 10 }}>
            <label>Motivo</label>
            <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Cuéntanos qué necesitas corregir y por qué" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="boton" style={{ flex: 1 }} disabled={enviandoMotivo} onClick={pedirAutorizacion}>
              {enviandoMotivo ? "Enviando…" : "Enviar solicitud"}
            </button>
            <button
              type="button"
              className="boton-secundario"
              style={{ flex: 1, width: "auto" }}
              onClick={() => { setPidiendo(false); setMotivo(""); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ModalCompartir
        abierto={compartiendo}
        onCerrar={() => setCompartiendo(false)}
        titulo="Reporte de Aportes"
        mensajeInicial={textoReporte()}
        nombreArchivo={`aportes-${campus}-${fecha}`}
      />
    </div>
  );
}
