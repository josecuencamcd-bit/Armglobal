"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ASIS_IDS, VOL_IDS, CATEGORIAS, METODOS, MODALIDADES, equiposVigentes } from "@/lib/sesiones";

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
 * área (con +/-), aceptaron a Jesús (presencial y online), líderes/adm. de
 * turno y aportes — equivalente a la vista principal del módulo Encuentros
 * del HTML embebido de Code.gs (api_estado / api_setCampo).
 */
export default function EncuentroPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;

  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

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

  async function agregarAporte(form: FormData) {
    const res = await fetch(`/api/sesiones/${key}/aportes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.get("nombre"),
        monto: Number(form.get("monto")),
        categoria: form.get("categoria"),
        metodo: form.get("metodo"),
      }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function borrarAporte(id: string) {
    if (!confirm("¿Eliminar este aporte?")) return;
    const res = await fetch(`/api/sesiones/${key}/aportes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function compartir() {
    if (!estado) return;
    const totAsis = estado.asistencia.reduce((s, a) => s + a.cantidad, 0);
    const totVol = estado.voluntarios.reduce((s, v) => s + v.cantidad, 0);
    const texto = `${encuentro} · ${campus}\n${fechaCL(fecha)}\nAsistencia: ${totAsis}\nVoluntarios: ${totVol}\nTotal: ${totAsis + totVol}`;
    if (navigator.share) {
      navigator.share({ title: "Reporte", text: texto }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(texto);
      alert("Resumen copiado al portapapeles.");
    }
  }

  if (!estado && !error) return <div className="contenedor">Cargando…</div>;

  const [campus, encuentro, , fecha] = decodeURIComponent(key).split("|");
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
      {estado?.finalizado && (
        <p className="aviso">Este encuentro está finalizado. Pide autorización para modificarlo.</p>
      )}

      {estado && (
        <>
          <Seccion titulo="Responsable">
            <select
              value={estado.sesion?.responsable ?? estado.responsable}
              disabled={guardando || estado.finalizado}
              onChange={(e) => setCampo("responsable", e.target.value)}
            >
              {equiposVigentes().map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </Seccion>

          <Seccion titulo="Datos del reporte">
            <div className="campo">
              <label>Modalidad</label>
              <select
                value={estado.sesion?.modalidad ?? MODALIDADES[0]}
                disabled={guardando || estado.finalizado}
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
                disabled={guardando || estado.finalizado}
                onBlur={(e) => setCampo("predicador", e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Nombre del mensaje</label>
              <input
                defaultValue={estado.sesion?.mensaje ?? ""}
                placeholder="Título del mensaje"
                disabled={guardando || estado.finalizado}
                onBlur={(e) => setCampo("mensaje", e.target.value)}
              />
            </div>
          </Seccion>

          <Seccion titulo="Presencial">
            <Stepper
              label="Aceptaron a Jesús"
              valor={estado.sesion?.aceptaron ?? 0}
              disabled={guardando || estado.finalizado}
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
                  disabled={guardando || estado.finalizado}
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
                  disabled={guardando || estado.finalizado}
                  onChange={(v) => setCampo(`vol_${id}`, v)}
                />
              );
            })}
          </Seccion>

          <Seccion titulo="Online">
            <Stepper
              label="Aceptaron a Jesús"
              valor={estado.sesion?.on_acepto ?? 0}
              disabled={guardando || estado.finalizado}
              onChange={(v) => setCampo("onAcepto", v)}
            />
            <Stepper
              label="Espectadores a la vez"
              valor={estado.sesion?.on_espect ?? 0}
              disabled={guardando || estado.finalizado}
              onChange={(v) => setCampo("onEspect", v)}
            />
          </Seccion>

          <div className="tarjeta">
            <div className="campo">
              <label>Líderes de voluntarios</label>
              <input
                defaultValue={estado.sesion?.lideres ?? ""}
                placeholder="Nombres"
                disabled={guardando || estado.finalizado}
                onBlur={(e) => setCampo("lideres", e.target.value)}
              />
            </div>
            <div className="campo" style={{ marginBottom: 0 }}>
              <label>Adm. de campus</label>
              <select
                value={estado.sesion?.adm ?? ""}
                disabled={guardando || estado.finalizado}
                onChange={(e) => setCampo("adm", e.target.value)}
              >
                {equipos.map((eq) => <option key={eq || "ninguno"} value={eq}>{eq || "Sin asignar"}</option>)}
              </select>
            </div>
          </div>

          <div className="tarjeta">
            <p className="titulo" style={{ fontSize: "1rem", marginTop: 0 }}>Aportes</p>
            {estado.aportes.map((ap) => (
              <div className="fila" key={ap.id}>
                <span>{ap.nombre} · {ap.categoria} · {ap.metodo}</span>
                <span className="num">
                  ${ap.monto.toLocaleString("es-CL")}{" "}
                  <button className="boton-peligro" type="button" onClick={() => borrarAporte(ap.id)} disabled={estado.finalizado}>✕</button>
                </span>
              </div>
            ))}
            {!estado.finalizado && (
              <form action={(fd) => agregarAporte(fd)} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input name="nombre" placeholder="Nombre" required />
                <input name="monto" type="number" placeholder="Monto" required />
                <select name="categoria" defaultValue={CATEGORIAS[0]}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select name="metodo" defaultValue={METODOS[0]}>
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button className="boton-secundario" type="submit">Agregar aporte</button>
              </form>
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
              onClick={compartir}
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
              disabled={!estado.finalizado}
              onClick={() => alert("Pide a un Admin app que autorice la edición de este encuentro ya finalizado.")}
              style={{
                flex: 1, borderRadius: 10, padding: "12px 6px", fontWeight: 600, fontSize: "0.85rem",
                border: "1px solid var(--line)", background: "var(--surface-2)",
                color: estado.finalizado ? "var(--ink)" : "var(--muted)",
                cursor: estado.finalizado ? "pointer" : "default", opacity: estado.finalizado ? 1 : 0.5,
                whiteSpace: "pre-line",
              }}
            >
              Modificar{"\n"}registro
            </button>
          </div>
          <p className="sync-status">
            <span className="punto" />
            Sincronizado · {new Date(estado.sesion?.actualizado ?? Date.now()).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </p>
        </>
      )}
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
