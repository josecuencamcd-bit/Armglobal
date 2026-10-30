"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/lib/iconos";

type Acceso = { correo: string; nombre: string; nota: string | null; estado: string };
type AutEncuentro = { id: number; nombre: string; campus: string; encuentro: string; fecha: string; motivo: string; estado: string };
type AutFondos = { id: number; solicitante: string | null; campus: string; area: string; mes: string; motivo: string; estado: string };
type Propuesta = {
  id: number; nombres: string; fecha: string; estado: string;
  saludo: string | null; mensaje: string | null; abrazo: string | null;
  gracias: string | null; versiculo: string | null; html?: string;
};
type CampoCumple = "saludo" | "mensaje" | "abrazo" | "gracias" | "versiculo";

const TILES: { key: string; label: string; icon: string; href?: string }[] = [
  { key: "accesos", label: "Accesos", icon: "soporte" },
  { key: "perfiles", label: "Perfiles", icon: "perfiles", href: "/perfiles" },
  { key: "fondos", label: "Fondos", icon: "fondo", href: "/fondos" },
  { key: "cumpleanos", label: "Cumpleaños", icon: "cumples", href: "/cumpleanos" },
  { key: "turnos", label: "Turnos", icon: "turnos", href: "/turnos" },
  { key: "nombres", label: "Nombres", icon: "perfiles", href: "/perfiles" },
  { key: "actividad", label: "Actividad", icon: "actividad", href: "/actividad" },
];

/** Soporte: mismo menú de la app vieja (grilla Accesos/Perfiles/Fondos/
 * Cumpleaños/Turnos/Nombres). "Accesos" se resuelve en esta misma
 * pantalla; el resto son atajos a su módulo. Abajo, autorizaciones que no
 * tienen otro lugar en el nav (reabrir un encuentro o un mes de fondos
 * cerrado, y mensajes de cumpleaños por aprobar). */
export default function SoportePage() {
  const router = useRouter();
  const [accesos, setAccesos] = useState<Acceso[] | null>(null);
  const [autEnc, setAutEnc] = useState<AutEncuentro[] | null>(null);
  const [autFon, setAutFon] = useState<AutFondos[] | null>(null);
  const [cumples, setCumples] = useState<Propuesta[] | null>(null);
  const [ultimosSaludos, setUltimosSaludos] = useState<Propuesta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [borrador, setBorrador] = useState<Record<CampoCumple, string>>({ saludo: "", mensaje: "", abrazo: "", gracias: "", versiculo: "" });

  const cargar = useCallback(async () => {
    const [ra, rae, raf, rc] = await Promise.all([
      fetch("/api/solicitudes-acceso"),
      fetch("/api/autorizaciones"),
      fetch("/api/fondos/autorizaciones"),
      fetch("/api/cumpleanos/propuestas"),
    ]);
    const [ja, jae, jaf, jc] = await Promise.all([ra.json(), rae.json(), raf.json(), rc.json()]);
    if (ja.ok) setAccesos(ja.data.filter((x: Acceso) => x.estado === "Pendiente"));
    if (jae.ok) setAutEnc(jae.data.filter((x: AutEncuentro) => x.estado === "Pendiente"));
    if (jaf.ok) setAutFon(jaf.data.filter((x: AutFondos) => x.estado === "Pendiente Pastor" || x.estado === "Pendiente Admin"));
    if (jc.ok) {
      setCumples(jc.data.filter((x: Propuesta) => x.estado === "Pendiente"));
      setUltimosSaludos(
        jc.data
          .filter((x: Propuesta) => x.estado === "Enviada")
          .sort((a: Propuesta, b: Propuesta) => (a.fecha < b.fecha ? 1 : -1))
          .slice(0, 8)
      );
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function resolver(url: string, llave: string, body: Record<string, unknown>) {
    setOcupado(llave);
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function resolverAcceso(correo: string, aprobar: boolean) {
    setOcupado(correo);
    const res = await fetch(`/api/solicitudes-acceso/${encodeURIComponent(correo)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobar }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function resolverCumple(id: number, aprobar: boolean) {
    setOcupado(`c${id}`);
    const res = await fetch(`/api/cumpleanos/propuestas/${id}/${aprobar ? "aprobar" : "anular"}`, { method: "PATCH" });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  function abrirEdicion(c: Propuesta) {
    setEditando(c.id);
    setBorrador({
      saludo: c.saludo ?? "", mensaje: c.mensaje ?? "", abrazo: c.abrazo ?? "",
      gracias: c.gracias ?? "", versiculo: c.versiculo ?? "",
    });
  }

  async function guardarEdicion(id: number) {
    setOcupado(`c${id}`);
    const res = await fetch(`/api/cumpleanos/propuestas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(borrador),
    });
    const json = await res.json();
    setOcupado(null);
    if (!json.ok) { setError(json.error); return; }
    setEditando(null);
    await cargar();
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem", marginBottom: 16 }}>Soporte</h1>
      {error && <p className="aviso">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
        {TILES.map((t) => (
          <button
            key={t.key}
            onClick={() => t.href && router.push(t.href)}
            className="tarjeta"
            style={{
              display: "flex", alignItems: "center", gap: 10, margin: 0, padding: "14px 16px",
              cursor: "pointer", textAlign: "left",
              background: t.key === "accesos" ? "var(--gold-grad)" : undefined,
              color: t.key === "accesos" ? "#1a1203" : undefined,
              border: t.key === "accesos" ? "none" : undefined,
            }}
          >
            <Icono id={t.icon} size={20} />
            <span style={{ fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <Seccion titulo="Solicitudes de acceso" vacio="No hay solicitudes pendientes." cantidad={accesos?.length}>
        {accesos?.map((a) => (
          <div className="fila" key={a.correo}>
            <div>
              <div>{a.nombre}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{a.correo}{a.nota ? ` · ${a.nota}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === a.correo} onClick={() => resolverAcceso(a.correo, true)}>Aprobar</button>
              <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} disabled={ocupado === a.correo} onClick={() => resolverAcceso(a.correo, false)}>Rechazar</button>
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Cumpleaños por aprobar" vacio="Sin mensajes pendientes." cantidad={cumples?.length}>
        {cumples?.map((c, i) => (
          <div key={c.id} style={{ padding: "10px 0", borderBottom: i < (cumples?.length ?? 0) - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <b style={{ fontSize: "0.92rem" }}>{JSON.parse(c.nombres || "[]").map((p: { n: string }) => p.n).join(", ") || c.nombres}</b>
              <span className="muted" style={{ fontSize: "0.78rem" }}>{c.fecha}</span>
            </div>

            {c.html && (
              <div
                style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10, border: "1px solid var(--line)" }}
                dangerouslySetInnerHTML={{ __html: c.html }}
              />
            )}

            {editando === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {(["saludo", "mensaje", "abrazo", "versiculo", "gracias"] as CampoCumple[]).map((campo) => (
                  <div className="campo" key={campo} style={{ marginBottom: 0 }}>
                    <label>{campo === "gracias" ? "Agradecimiento (opcional)" : campo.charAt(0).toUpperCase() + campo.slice(1)}</label>
                    <textarea
                      rows={campo === "versiculo" ? 2 : 2}
                      value={borrador[campo]}
                      onChange={(e) => setBorrador((b) => ({ ...b, [campo]: e.target.value }))}
                      maxLength={700}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === `c${c.id}`} onClick={() => guardarEdicion(c.id)}>Guardar</button>
                  <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} onClick={() => setEditando(null)}>Cancelar</button>
                </div>
                <p className="muted" style={{ fontSize: "0.72rem", margin: 0 }}>Al guardar vuelve a quedar Pendiente: hay que aprobarlo de nuevo.</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === `c${c.id}`} onClick={() => resolverCumple(c.id, true)}>Aprobar</button>
                <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} disabled={ocupado === `c${c.id}`} onClick={() => abrirEdicion(c)}>Editar texto</button>
                <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} disabled={ocupado === `c${c.id}`} onClick={() => resolverCumple(c.id, false)}>No enviar</button>
              </div>
            )}
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Últimos saludos" vacio="Aún no se ha enviado ningún saludo." cantidad={ultimosSaludos?.length}>
        {ultimosSaludos?.map((c) => (
          <div className="fila" key={c.id}>
            <div>{c.nombres}</div>
            <span className="muted" style={{ fontSize: "0.78rem" }}>{c.fecha}</span>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Reabrir encuentros" vacio="Sin solicitudes pendientes." cantidad={autEnc?.length}>
        {autEnc?.map((a) => (
          <div className="fila" key={a.id}>
            <div>
              <div>{a.nombre} · {a.campus}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{a.encuentro} · {a.fecha} · {a.motivo}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === `ae${a.id}`} onClick={() => resolver(`/api/autorizaciones/${a.id}`, `ae${a.id}`, { aprobar: true })}>Autorizar</button>
              <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} disabled={ocupado === `ae${a.id}`} onClick={() => resolver(`/api/autorizaciones/${a.id}`, `ae${a.id}`, { aprobar: false })}>Rechazar</button>
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Reabrir mes de fondos" vacio="Sin solicitudes pendientes." cantidad={autFon?.length}>
        {autFon?.map((a) => (
          <div className="fila" key={a.id}>
            <div>
              <div>{a.solicitante ?? "—"} · {a.campus}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{a.area} · {a.mes} · {a.motivo}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === `af${a.id}`} onClick={() => resolver(`/api/fondos/autorizaciones/${a.id}`, `af${a.id}`, { aprobar: true })}>Dar Ok / Aprobar</button>
              <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} disabled={ocupado === `af${a.id}`} onClick={() => resolver(`/api/fondos/autorizaciones/${a.id}`, `af${a.id}`, { aprobar: false })}>Rechazar</button>
            </div>
          </div>
        ))}
      </Seccion>

    </div>
  );
}

function Seccion({ titulo, vacio, cantidad, children }: { titulo: string; vacio: string; cantidad?: number; children: React.ReactNode }) {
  if (cantidad === undefined) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontWeight: 600, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
        {titulo}
        {cantidad > 0 && (
          <span style={{ background: "var(--accent)", color: "var(--accent-ink)", borderRadius: 999, fontSize: "0.72rem", padding: "1px 8px", fontWeight: 700 }}>
            {cantidad}
          </span>
        )}
      </p>
      {cantidad === 0 ? <p className="muted">{vacio}</p> : <div className="tarjeta" style={{ padding: "4px 12px" }}>{children}</div>}
    </div>
  );
}
