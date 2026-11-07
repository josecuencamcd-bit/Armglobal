"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ASIS_IDS, VOL_IDS, MODALIDADES, equiposVigentes } from "@/lib/sesiones";
import { fotoAJpegDataUrl } from "@/lib/fotos-cliente";
import ModalCompartir from "@/components/ModalCompartir";

type Foto = { path: string; url: string };

const ASIS_LABELS: Record<string, string> = {
  auditorio: "Auditorio", kids: "Kids", tweens: "Tweens",
  bebes: "Sala bebé: bebés", papas: "Sala bebé: papás", sensorial: "Sala sensorial",
};
const VOL_LABELS: Record<string, string> = {
  servicio: "Servicio", tecnica: "Técnica", kids: "Kids", tweens: "Tweens", worship: "Worship",
  cocina: "Cocina", rrss: "R.R.S.S", seguridad: "Seguridad", salabebes: "Sala bebés",
  conexion: "Conexión", oracion: "Oración", merch: "Merch", amor: "Amor por la casa", sensorial: "Sala sensorial",
};

type Sesion = {
  responsable: string | null; modalidad: string | null; predicador: string | null;
  mensaje: string | null; lideres: string | null; adm: string | null;
  aceptaron: number | null; on_acepto: number | null; on_espect: number | null;
  actualizado: string | null;
};
type Estado = {
  key: string;
  responsable: string;
  // Administradores asignados en Administración semanal para la semana de
  // este encuentro — si viene vacío, el Responsable se elige de la lista
  // tradicional de equipos (una sola opción); si no, se precarga con estos
  // nombres y se pueden marcar/desmarcar varios.
  administracionAsignada: string[];
  finalizado: boolean;
  sesion: Sesion | null;
  asistencia: { area: string; cantidad: number }[];
  voluntarios: { area: string; cantidad: number }[];
  aportes: { id: string; nombre: string; monto: number; categoria: string; metodo: string }[];
};

function fechaCL(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Reporte de un encuentro: datos del reporte, asistencia/voluntarios por
 * área (con +/-), aceptaron a Jesús (presencial y online), líderes/adm.
 * de campus y aportes — equivalente a la vista principal del módulo Encuentros
 * del HTML embebido de Code.gs (api_estado / api_setCampo).
 */
export default function EncuentroPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;

  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);

  // Autorización para modificar un encuentro finalizado (api_autPedir /
  // auth_autorizado): si tengo una solicitud "Autorizada" y vigente para
  // esta misma sesión, los campos se vuelven a habilitar; si tengo una
  // "Pendiente", muestro ese estado en vez del formulario para pedir otra.
  const [autorizado, setAutorizado] = useState(false);
  const [solicitudPendiente, setSolicitudPendiente] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviandoMotivo, setEnviandoMotivo] = useState(false);

  // Fotos del cierre del POS (api_subirFoto / api_delFoto / api_getFoto):
  // hasta 6 fotos del comprobante de cierre de caja de este encuentro.
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const cargarFotos = useCallback(async () => {
    const res = await fetch(`/api/sesiones/${key}/fotos`);
    const json = await res.json();
    if (json.ok) setFotos(json.data.fotos);
  }, [key]);

  async function subirFoto(file: File) {
    setErrorFoto(null);
    setSubiendoFoto(true);
    try {
      const dataUrl = await fotoAJpegDataUrl(file);
      const res = await fetch(`/api/sesiones/${key}/fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto: dataUrl }),
      });
      const json = await res.json();
      if (!json.ok) { setErrorFoto(json.error); return; }
      await cargarFotos();
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function borrarFoto(path: string) {
    if (!confirm("¿Borrar esta foto del cierre?")) return;
    const res = await fetch(`/api/sesiones/${key}/fotos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const json = await res.json();
    if (!json.ok) { setErrorFoto(json.error); return; }
    await cargarFotos();
  }

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
    setSolicitudPendiente(mias.some((a) => a.estado === "Pendiente"));
  }, [key]);

  useEffect(() => {
    cargar();
    cargarAutorizacion();
    cargarFotos();
  }, [cargar, cargarAutorizacion, cargarFotos]);

  async function pedirAutorizacion() {
    if (!motivo.trim()) { setError("Cuéntanos el motivo para pedir autorización."); return; }
    setEnviandoMotivo(true);
    const [c, e, ev, f] = decodeURIComponent(key).split("|");
    const res = await fetch("/api/autorizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campus: c, encuentro: e, evento: ev, fecha: f, motivo: motivo.trim() }),
    });
    const json = await res.json();
    setEnviandoMotivo(false);
    if (!json.ok) { setError(json.error); return; }
    setPidiendo(false);
    setMotivo("");
    setError(null);
    await cargarAutorizacion();
  }

  async function setCampo(campo: string, valor: string | number) {
    setGuardando(true);
    const res = await fetch(`/api/sesiones/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campo, valor }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setEstado(json.data);
  }

  async function finalizar() {
    if (!confirm("¿Marcar este encuentro como finalizado?")) return;
    const res = await fetch(`/api/sesiones/${key}/finalizar`, { method: "POST" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setEstado(json.data);
  }

  /** buildReport() de app.html: el resumen que se compartía por WhatsApp —
   * fecha, modalidad, predicador/mensaje, aceptaron a Jesús, desglose por
   * área de asistencia y de voluntarios, online, líderes y adm. de campus.
   * Ahora se muestra en ModalCompartir (mensaje editable + Cerrar/Copiar +
   * PDF/Excel/correo), igual que la app vieja — antes era navigator.share
   * directo con fallback a portapapeles. */
  function textoReporte() {
    if (!estado) return "";
    const s = estado.sesion;
    const asis = (id: string) => estado.asistencia.find((a) => a.area === id)?.cantidad ?? 0;
    const bebes = asis("bebes") + asis("papas");
    const nombreEnc = encuentro === "Evento Especial" && evento ? evento : encuentro;

    const L: string[] = [];
    L.push(`Reporte Encuentro Campus ${campus}`, "");
    L.push(`*Fecha:* ${fechaCL(fecha)}`);
    L.push(`*Encuentro* ${nombreEnc}`);
    L.push(`*Modalidad:* ${(s?.modalidad ?? "").trim()}`);
    L.push(`*Campus:* ${campus}`, "");
    L.push(`*Predicador:* ${(s?.predicador ?? "").trim()}`);
    L.push(`*Nombre:* ${(s?.mensaje ?? "").trim()}`, "");
    L.push("*Presencial*", `Aceptaron a Jesús: ${s?.aceptaron ?? 0}`, `Total general: ${totAsis + totVol}`, "");
    L.push("*Asistencia*");
    L.push(`- Auditorio: ${asis("auditorio")}`, `- Kids: ${asis("kids")}`, `- Tweens: ${asis("tweens")}`);
    L.push(`- Sala bebe: ${bebes}`);
    L.push(`- Sala sensorial: ${asis("sensorial")}`, "");
    L.push("*Voluntarios*");
    VOL_IDS.forEach((id) => {
      const cantidad = estado.voluntarios.find((v) => v.area === id)?.cantidad ?? 0;
      L.push(`- ${VOL_LABELS[id] ?? id}: ${cantidad}`);
    });
    L.push("", "_*Online*_", `Aceptaron a Jesús: ${s?.on_acepto ?? 0}`, `Espectadores a la vez: ${s?.on_espect ?? 0}`, "");
    L.push(`*Líderes de voluntarios*: ${(s?.lideres ?? "").trim()}`, "");
    L.push(`*Adm. de Campus*: ${(s?.adm ?? "").trim()}`);
    return L.join("\n");
  }

  if (!estado && !error) return <div className="contenedor">Cargando…</div>;

  const [campus, encuentro, evento, fecha] = decodeURIComponent(key).split("|");
  const equipos = ["", ...equiposVigentes()];
  const totAsis = estado?.asistencia.reduce((s, a) => s + a.cantidad, 0) ?? 0;
  const totVol = estado?.voluntarios.reduce((s, v) => s + v.cantidad, 0) ?? 0;

  return (
    <div className="contenedor" style={{ paddingTop: 20 }}>
      <Link href="/encuentros" className="muted" style={{ fontSize: "0.82rem", textDecoration: "none" }}>
        ‹ Encuentros
      </Link>
      <h1 className="titulo" style={{ fontSize: "1.2rem", margin: "4px 0 0" }}>Reporte</h1>
      <p className="muted" style={{ margin: "2px 0 16px" }}>
        {encuentro} · {campus} · {fechaCL(fecha)}
      </p>
      {error && <p className="aviso">{error}</p>}
      {estado?.finalizado && autorizado && (
        <p className="ok">Tienes autorización vigente para modificar este encuentro.</p>
      )}
      {estado?.finalizado && !autorizado && !solicitudPendiente && (
        <p className="aviso">Este encuentro está finalizado. Pide autorización para modificarlo.</p>
      )}
      {estado?.finalizado && !autorizado && solicitudPendiente && (
        <p className="aviso">Ya pediste autorización para modificar este encuentro — esperando que un Admin app la apruebe.</p>
      )}

      {estado && (
        <>
          <Seccion titulo="Responsable">
            {estado.administracionAsignada.length > 0 ? (
              <ResponsableAdministracion
                administracion={estado.administracionAsignada}
                valor={estado.sesion?.responsable ?? estado.responsable}
                disabled={guardando || (estado.finalizado && !autorizado)}
                onToggle={(nombres) => setCampo("responsable", nombres.join(" y "))}
              />
            ) : (
              <div className="campo">
                <select
                  value={estado.sesion?.responsable ?? estado.responsable}
                  disabled={guardando || (estado.finalizado && !autorizado)}
                  onChange={(e) => setCampo("responsable", e.target.value)}
                >
                  {equiposVigentes().map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
            )}
          </Seccion>

          <Seccion titulo="Datos del reporte">
            <div className="campo">
              <label>Modalidad</label>
              <select
                value={estado.sesion?.modalidad ?? MODALIDADES[0]}
                disabled={guardando || (estado.finalizado && !autorizado)}
                onChange={(e) => setCampo("modalidad", e.target.value)}
              >
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="campo">
              <label>Predicador</label>
              <input
                defaultValue={estado.sesion?.predicador ?? ""}
                placeholder="Nombre del predicador"
                disabled={guardando || (estado.finalizado && !autorizado)}
                onBlur={(e) => setCampo("predicador", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Nombre del mensaje</label>
              <input
                defaultValue={estado.sesion?.mensaje ?? ""}
                placeholder="Título del mensaje"
                disabled={guardando || (estado.finalizado && !autorizado)}
                onBlur={(e) => setCampo("mensaje", e.target.value)}
              />
            </div>
          </Seccion>

          <Seccion titulo="Presencial">
            <Stepper
              label="Aceptaron a Jesús"
              valor={estado.sesion?.aceptaron ?? 0}
              disabled={guardando || (estado.finalizado && !autorizado)}
              onChange={(v) => setCampo("aceptaron", v)}
            />
          </Seccion>

          <Seccion titulo="Asistencia" badge={totAsis}>
            {ASIS_IDS.map((id) => {
              const fila = estado.asistencia.find((a) => a.area === id);
              return (
                <Stepper
                  key={id}
                  label={ASIS_LABELS[id] ?? id}
                  valor={fila?.cantidad ?? 0}
                  disabled={guardando || (estado.finalizado && !autorizado)}
                  onChange={(v) => setCampo(`asis_${id}`, v)}
                />
              );
            })}
          </Seccion>

          <Seccion titulo="Voluntarios" badge={totVol}>
            {VOL_IDS.map((id) => {
              const fila = estado.voluntarios.find((v) => v.area === id);
              return (
                <Stepper
                  key={id}
                  label={VOL_LABELS[id] ?? id}
                  valor={fila?.cantidad ?? 0}
                  disabled={guardando || (estado.finalizado && !autorizado)}
                  onChange={(v) => setCampo(`vol_${id}`, v)}
                />
              );
            })}
          </Seccion>

          <Seccion titulo="Online">
            <Stepper
              label="Aceptaron a Jesús"
              valor={estado.sesion?.on_acepto ?? 0}
              disabled={guardando || (estado.finalizado && !autorizado)}
              onChange={(v) => setCampo("onAcepto", v)}
            />
            <Stepper
              label="Espectadores a la vez"
              valor={estado.sesion?.on_espect ?? 0}
              disabled={guardando || (estado.finalizado && !autorizado)}
              onChange={(v) => setCampo("onEspect", v)}
            />
          </Seccion>

          <div className="tarjeta">
            <div className="campo">
              <label>Líderes de voluntarios</label>
              <input
                defaultValue={estado.sesion?.lideres ?? ""}
                placeholder="Nombres"
                disabled={guardando || (estado.finalizado && !autorizado)}
                onBlur={(e) => setCampo("lideres", e.target.value)}
              />
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <label>Adm. de campus</label>
              <select
                value={estado.sesion?.adm ?? ""}
                disabled={guardando || (estado.finalizado && !autorizado)}
                onChange={(e) => setCampo("adm", e.target.value)}
              >
                {equipos.map((eq) => <option key={eq || "ninguno"} value={eq}>{eq || "Sin asignar"}</option>)}
              </select>
            </div>
          </div>

          <Link href={`/encuentros/${key}/aportes`} className="tarjeta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", color: "inherit" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Aportes</p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                {estado.aportes.length} registrado{estado.aportes.length === 1 ? "" : "s"} · ${estado.aportes.reduce((s, a) => s + a.monto, 0).toLocaleString("es-CL")}
              </p>
            </div>
            <span className="muted">›</span>
          </Link>

          <div className="tarjeta">
            <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Foto del cierre del POS</p>
            {errorFoto && <p className="aviso">{errorFoto}</p>}
            {fotos && fotos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {fotos.map((f) => (
                  <div key={f.path} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="Cierre" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                    {!(estado.finalizado && !autorizado) && (
                      <button
                        type="button"
                        onClick={() => borrarFoto(f.path)}
                        style={{
                          position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%",
                          border: "none", background: "var(--danger)", color: "#fff", fontSize: "0.7rem", cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!fotos && <p className="muted" style={{ fontSize: "0.8rem" }}>Cargando fotos…</p>}
            {fotos && fotos.length >= 6 && <p className="muted" style={{ fontSize: "0.78rem" }}>Ya hay 6 fotos (máximo).</p>}
            {fotos && fotos.length < 6 && !(estado.finalizado && !autorizado) && (
              <label className="boton-secundario" style={{ display: "inline-block", fontSize: "0.8rem", cursor: "pointer" }}>
                {subiendoFoto ? "Subiendo…" : "+ Agregar foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={subiendoFoto}
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          <div className="tarjeta">
            <div className="fila"><span className="muted">Asistencia</span><span className="num">{totAsis}</span></div>
            <div className="fila"><span className="muted">Voluntarios</span><span className="num">{totVol}</span></div>
            <div className="fila" style={{ fontWeight: 700 }}><span>Total general</span><span className="num">{totAsis + totVol}</span></div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 4 }}>
            <button
              type="button"
              style={{
                flex: 1, background: "var(--ok)", color: "#06281c", border: "none", fontWeight: 700,
                borderRadius: 10, padding: "12px 6px", cursor: "pointer", fontSize: "0.85rem",
              }}
              onClick={() => setCompartiendo(true)}
            >
              Compartir
            </button>
            <button
              type="button"
              disabled={estado.finalizado}
              onClick={finalizar}
              style={{
                flex: 1, borderRadius: 10, padding: "12px 6px", fontWeight: 700, fontSize: "0.85rem",
                border: "none", cursor: estado.finalizado ? "default" : "pointer",
                background: estado.finalizado ? "var(--gold-grad)" : "var(--surface-2)",
                color: estado.finalizado ? "var(--accent-ink)" : "var(--ink)",
                opacity: estado.finalizado ? 1 : 0.9,
                whiteSpace: "pre-line",
              }}
            >
              Encuentro{"\n"}finalizado
            </button>
            <button
              type="button"
              disabled={!estado.finalizado || autorizado || solicitudPendiente}
              onClick={() => setPidiendo(true)}
              style={{
                flex: 1, borderRadius: 10, padding: "12px 6px", fontWeight: 600, fontSize: "0.85rem",
                border: "1px solid var(--line)", background: "var(--surface-2)",
                color: estado.finalizado ? "var(--ink)" : "var(--muted)",
                cursor: estado.finalizado && !autorizado && !solicitudPendiente ? "pointer" : "default",
                opacity: estado.finalizado && !autorizado && !solicitudPendiente ? 1 : 0.5,
                whiteSpace: "pre-line",
              }}
            >
              Modificar{"\n"}registro
            </button>
          </div>

          {pidiendo && (
            <div className="tarjeta">
              <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Pedir autorización para modificar</p>
              <div className="campo" style={{ marginBottom: 10 }}>
                <label>Motivo</label>
                <textarea
                  rows={3}
                  value={motivo}
                  maxLength={300}
                  placeholder="¿Qué necesitas corregir y por qué?"
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="boton" disabled={enviandoMotivo} onClick={pedirAutorizacion}>
                  Enviar solicitud
                </button>
                <button
                  type="button"
                  style={{ padding: "12px 16px", background: "none", border: "1px solid var(--line)", borderRadius: 10, color: "var(--muted)" }}
                  onClick={() => { setPidiendo(false); setMotivo(""); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <p className="sync-status">
            <span className="punto" />
            Sincronizado · {new Date(estado.sesion?.actualizado ?? Date.now()).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </p>
        </>
      )}

      <ModalCompartir
        abierto={compartiendo}
        onCerrar={() => setCompartiendo(false)}
        titulo="Reporte Encuentro"
        mensajeInicial={textoReporte()}
        nombreArchivo={`encuentro-${key ? decodeURIComponent(key).split("|")[0] : ""}-${key ? decodeURIComponent(key).split("|")[3] : ""}`}
      />
    </div>
  );
}

/**
 * Responsable precargado desde Administración semanal: muestra como chips a
 * los administradores que el pastor de campus asignó para la semana de
 * este encuentro, todos marcados por defecto (así llega "como ya definido"
 * sin que nadie tenga que elegir). Si hay un cambio de última hora, se
 * tocan para marcar/desmarcar — el orden del guardado sigue siempre el de
 * `administracion` para que no "salte" al tocar distintos nombres.
 */
function ResponsableAdministracion({
  administracion, valor, disabled, onToggle,
}: { administracion: string[]; valor: string; disabled?: boolean; onToggle: (nombres: string[]) => void }) {
  const seleccionados = new Set(valor.split(" y ").map((n) => n.trim()).filter(Boolean));
  return (
    <div>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.78rem" }}>
        Precargado desde Administración semanal — toca para ajustar.
      </p>
      <div className="chips">
        {administracion.map((nombre) => {
          const activo = seleccionados.has(nombre);
          return (
            <button
              key={nombre}
              type="button"
              className="chip"
              aria-pressed={activo}
              disabled={disabled}
              onClick={() => {
                const siguiente = new Set(seleccionados);
                if (activo) siguiente.delete(nombre); else siguiente.add(nombre);
                onToggle(administracion.filter((n) => siguiente.has(n)));
              }}
            >
              {nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Seccion({ titulo, badge, children }: { titulo: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="tarjeta">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
        <span className="muted" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>
          {titulo}
        </span>
        {badge != null && <span className="num muted" style={{ fontSize: "0.75rem" }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Stepper({ label, valor, disabled, onChange }: { label: string; valor: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
      <span style={{ fontSize: "0.9rem" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          disabled={disabled || valor <= 0}
          onClick={() => onChange(Math.max(0, valor - 1))}
          style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)",
            background: "var(--surface-2)", color: "var(--ink)", fontSize: "1.1rem", lineHeight: 1, cursor: "pointer",
          }}
        >
          −
        </button>
        <span className="num" style={{ width: 24, textAlign: "center", fontWeight: 600 }}>{valor}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(valor + 1)}
          style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)",
            background: "var(--surface-2)", color: "var(--ink)", fontSize: "1.1rem", lineHeight: 1, cursor: "pointer",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
