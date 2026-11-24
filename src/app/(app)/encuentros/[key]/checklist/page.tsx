"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { hoy } from "@/lib/sesiones";
import { plantillaChecklist, type ChecklistItem } from "@/lib/checklist";
import ModalCompartir from "@/components/ModalCompartir";

type EstadoEncuentro = { responsable: string; finalizado: boolean; aportesFinalizado: boolean; checklistFinalizado: boolean };

function fechaCL(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Checklist pre-encuentro: tercera pantalla propia junto a Reporte y
 * Aportes (mismo patrón de navegación — "‹ Reporte" / "Aportes" arriba).
 * Arranca siempre con la misma plantilla fija (Mesa del Café, Baños,
 * Auditorio, etc. — la misma lista que se compartía por WhatsApp); el
 * administrador puede tildar cada ítem, anotar quién estuvo a cargo,
 * agregar/sacar un ítem puntual y dejar una observación general.
 *
 * Mismo candado que Reporte/Aportes: el mismo día del encuentro se edita
 * libre; pasado ese día hace falta autorización vigente. Cierre propio
 * (checklistFinalizado), independiente de Reporte y Aportes — el
 * encuentro completo se da por cerrado solo cuando los tres lo están.
 */
export default function ChecklistEncuentroPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;

  const [estado, setEstado] = useState<EstadoEncuentro | null>(null);
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);

  const [autorizado, setAutorizado] = useState(false);
  const [solicitudPendiente, setSolicitudPendiente] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviandoMotivo, setEnviandoMotivo] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/sesiones/${key}`);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setEstado(json.data);
    setError(null);
  }, [key]);

  const cargarChecklist = useCallback(async () => {
    const res = await fetch(`/api/sesiones/${key}/checklist`);
    const json = await res.json();
    if (!json.ok) { setItems(plantillaChecklist()); return; }
    setItems(json.data.items);
    setObservacion(json.data.observacion ?? "");
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
    cargarChecklist();
    cargarAutorizacion();
  }, [cargar, cargarChecklist, cargarAutorizacion]);

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

  function guardarDespuesDe(siguientesItems: ChecklistItem[], siguienteObservacion: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGuardando(true);
      try {
        const res = await fetch(`/api/sesiones/${key}/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: siguientesItems, observacion: siguienteObservacion }),
        });
        const json = await res.json();
        if (!json.ok) { setError(json.error); await cargarChecklist(); return; }
        setError(null);
      } catch {
        setError("No se pudo guardar — revisa tu conexión.");
        await cargarChecklist();
      } finally {
        setGuardando(false);
      }
    }, 600);
  }

  function actualizarItem(id: string, cambios: Partial<ChecklistItem>) {
    setItems((prev) => {
      if (!prev) return prev;
      const siguientes = prev.map((it) => (it.id === id ? { ...it, ...cambios } : it));
      guardarDespuesDe(siguientes, observacion);
      return siguientes;
    });
  }

  function agregarItem() {
    setItems((prev) => {
      const siguientes = [...(prev ?? []), { id: `extra-${Date.now()}`, titulo: "Nuevo ítem", detalle: "", personas: "", hecho: false }];
      guardarDespuesDe(siguientes, observacion);
      return siguientes;
    });
  }

  function quitarItem(id: string) {
    if (!confirm("¿Sacar este ítem del checklist?")) return;
    setItems((prev) => {
      if (!prev) return prev;
      const siguientes = prev.filter((it) => it.id !== id);
      guardarDespuesDe(siguientes, observacion);
      return siguientes;
    });
  }

  function cambiarObservacion(valor: string) {
    setObservacion(valor);
    guardarDespuesDe(items ?? [], valor);
  }

  async function finalizarChecklist(valor: boolean) {
    if (!confirm(valor ? "¿Marcar el Checklist de este encuentro como finalizado?" : "¿Reabrir el Checklist para seguir editándolo?")) return;
    const res = await fetch(`/api/sesiones/${key}/finalizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalizado: valor, campo: "checklist" }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  if (!items && !error) return <div className="contenedor">Cargando…</div>;

  const [campus, encuentro, , fecha] = decodeURIComponent(key).split("|");
  const esHoy = fecha === hoy();
  const bloqueado = !esHoy && !autorizado;
  const listaItems = items ?? [];

  function textoReporte() {
    const L: string[] = [];
    L.push(`✅ CHECKLIST – PRE ENCUENTRO ${encuentro}`);
    L.push(`📅 Fecha: ${fechaCL(fecha)}`);
    L.push("━━━━━━━━━━━━━━━");
    L.push("🏠 ÁREAS LISTAS");
    for (const it of listaItems) {
      const check = it.hecho ? " ✅" : "";
      if (it.detalle) {
        L.push(`🔹 ${it.titulo}`);
        L.push(`${it.detalle}${check}`);
      } else {
        L.push(`🔹 ${it.titulo}${check}`);
      }
      it.personas.split("\n").map((p) => p.trim()).filter(Boolean).forEach((p) => L.push(p));
    }
    L.push("━━━━━━━━━━━━━━━");
    L.push("✨ OBSERVACIÓN GENERAL", "");
    L.push(observacion || "—");
    L.push("━━━━━━━━━━━━━━━");
    L.push("🫶 Estamos atentos para cualquier apoyo o necesidad.");
    L.push("Vamos a disfrutar 🎉");
    return L.join("\n");
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
        <Link href={`/encuentros/${key}`} className="muted" style={{ fontSize: "0.82rem", textDecoration: "none" }}>‹ Reporte</Link>
        <Link href={`/encuentros/${key}/aportes`} className="muted" style={{ fontSize: "0.82rem", textDecoration: "none" }}>Aportes</Link>
        <h1 className="titulo" style={{ fontSize: "1.3rem", margin: 0 }}>Checklist</h1>
      </div>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.82rem" }}>
        {encuentro} · {campus} · {fechaCL(fecha)}{estado?.responsable ? ` · Responsable: ${estado.responsable}` : ""}
        {guardando && <span style={{ marginLeft: 8 }}>· guardando…</span>}
      </p>
      {error && <p className="aviso">{error}</p>}
      {!esHoy && autorizado && (
        <p className="ok">Tienes autorización vigente para modificar el checklist de este encuentro.</p>
      )}
      {!esHoy && !autorizado && !solicitudPendiente && (
        <p className="aviso">Este encuentro es de un día anterior. Pide autorización para modificar su checklist.</p>
      )}
      {!esHoy && !autorizado && solicitudPendiente && (
        <p className="aviso">Ya pediste autorización — esperando que el Pastor o Soporte la aprueben.</p>
      )}
      {estado && (
        <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 16px" }}>
          {estado.finalizado && estado.aportesFinalizado && estado.checklistFinalizado
            ? "Encuentro cerrado por completo — Reporte, Aportes y Checklist finalizados."
            : `Falta cerrar: ${[!estado.finalizado && "Reporte", !estado.aportesFinalizado && "Aportes", !estado.checklistFinalizado && "Checklist"].filter(Boolean).join(", ")}.`}
        </p>
      )}

      {listaItems.map((it) => (
        <div className="tarjeta" key={it.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => actualizarItem(it.id, { hecho: !it.hecho })}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 8, marginTop: 2,
                border: it.hecho ? "none" : "1px solid var(--line)",
                background: it.hecho ? "var(--ok)" : "var(--surface-2)",
                color: "#fff", fontSize: "0.9rem", cursor: bloqueado ? "default" : "pointer",
              }}
            >
              {it.hecho ? "✓" : ""}
            </button>
            <div style={{ flex: 1 }}>
              <input
                value={it.titulo}
                disabled={bloqueado}
                onChange={(e) => actualizarItem(it.id, { titulo: e.target.value })}
                style={{ fontWeight: 600, border: "none", background: "none", padding: 0, width: "100%" }}
              />
              <input
                value={it.detalle}
                disabled={bloqueado}
                placeholder="Detalle (opcional)"
                onChange={(e) => actualizarItem(it.id, { detalle: e.target.value })}
                className="muted"
                style={{ fontSize: "0.82rem", border: "none", background: "none", padding: 0, width: "100%", marginTop: 2 }}
              />
              <textarea
                value={it.personas}
                disabled={bloqueado}
                placeholder="Personas a cargo (una por línea)"
                rows={Math.max(1, it.personas.split("\n").length)}
                onChange={(e) => actualizarItem(it.id, { personas: e.target.value })}
                style={{ fontSize: "0.82rem", marginTop: 6, width: "100%", resize: "vertical" }}
              />
            </div>
            {!bloqueado && (
              <button className="boton-peligro" style={{ fontSize: "0.72rem", padding: "4px 8px" }} onClick={() => quitarItem(it.id)}>✕</button>
            )}
          </div>
        </div>
      ))}

      {!bloqueado && (
        <button type="button" className="boton-secundario" style={{ marginBottom: 16 }} onClick={agregarItem}>
          + Agregar ítem
        </button>
      )}

      <div className="tarjeta">
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Observación general</p>
        <textarea
          value={observacion}
          disabled={bloqueado}
          rows={3}
          placeholder="Campus preparado, áreas organizadas para recibir a las personas…"
          onChange={(e) => cambiarObservacion(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          className="boton"
          style={{ flex: 1, background: "var(--ok)" }}
          onClick={() => setCompartiendo(true)}
        >
          Compartir checklist
        </button>
        <button
          type="button"
          disabled={bloqueado || !estado}
          onClick={() => finalizarChecklist(!estado?.checklistFinalizado)}
          style={{
            flex: 1, borderRadius: 10, padding: "12px 6px", fontWeight: 700, fontSize: "0.85rem",
            border: "none", cursor: bloqueado ? "default" : "pointer",
            background: estado?.checklistFinalizado ? "var(--gold-grad)" : "var(--surface-2)",
            color: estado?.checklistFinalizado ? "var(--accent-ink)" : "var(--ink)",
            opacity: bloqueado ? 0.5 : estado?.checklistFinalizado ? 1 : 0.9,
            whiteSpace: "pre-line",
          }}
        >
          {estado?.checklistFinalizado ? <>Reabrir{"\n"}checklist</> : <>Checklist{"\n"}finalizado</>}
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
        titulo="Checklist Pre Encuentro"
        mensajeInicial={textoReporte()}
        nombreArchivo={`checklist-${campus}-${fecha}`}
      />
    </div>
  );
}
