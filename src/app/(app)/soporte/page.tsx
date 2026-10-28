"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Acceso = { correo: string; nombre: string; nota: string | null; estado: string };
type Baja = { id: number; nombre: string | null; campus: string; area: string; motivo: string; estado: string };
type AutEncuentro = { id: number; nombre: string; campus: string; encuentro: string; fecha: string; motivo: string; estado: string };
type AutFondos = { id: number; solicitante: string | null; campus: string; area: string; mes: string; motivo: string; estado: string };
type Propuesta = { id: number; nombres: string; fecha: string; mensaje: string | null; estado: string };

/** Soporte: hub de administración, equivalente al menú Soporte de la app
 * vieja — accesos nuevos, bajas de integrantes, cumpleaños por aprobar y
 * autorizaciones (reabrir un encuentro cerrado / un mes de fondos), todo
 * en un solo lugar para Admin app / Pastores. */
export default function SoportePage() {
  const [accesos, setAccesos] = useState<Acceso[] | null>(null);
  const [bajas, setBajas] = useState<Baja[] | null>(null);
  const [autEnc, setAutEnc] = useState<AutEncuentro[] | null>(null);
  const [autFon, setAutFon] = useState<AutFondos[] | null>(null);
  const [cumples, setCumples] = useState<Propuesta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [ra, rb, rae, raf, rc] = await Promise.all([
      fetch("/api/solicitudes-acceso"),
      fetch("/api/integrantes/solicitudes-baja"),
      fetch("/api/autorizaciones"),
      fetch("/api/fondos/autorizaciones"),
      fetch("/api/cumpleanos/propuestas"),
    ]);
    const [ja, jb, jae, jaf, jc] = await Promise.all([ra.json(), rb.json(), rae.json(), raf.json(), rc.json()]);
    if (ja.ok) setAccesos(ja.data.filter((x: Acceso) => x.estado === "Pendiente"));
    if (jb.ok) setBajas(jb.data.filter((x: Baja) => x.estado === "Pendiente"));
    if (jae.ok) setAutEnc(jae.data.filter((x: AutEncuentro) => x.estado === "Pendiente"));
    if (jaf.ok) setAutFon(jaf.data.filter((x: AutFondos) => x.estado === "Pendiente Pastor" || x.estado === "Pendiente Admin"));
    if (jc.ok) setCumples(jc.data.filter((x: Propuesta) => x.estado === "Pendiente"));
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

  const cargando = accesos === null && bajas === null && autEnc === null && autFon === null && cumples === null;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Soporte</h1>
      {error && <p className="aviso">{error}</p>}
      {cargando && <p className="muted">Cargando…</p>}

      <Seccion titulo="Solicitudes de acceso" vacio="Sin solicitudes pendientes." cantidad={accesos?.length}>
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

      <Seccion titulo="Bajas de integrantes" vacio="Sin bajas pendientes." cantidad={bajas?.length}>
        {bajas?.map((b) => (
          <div className="fila" key={b.id}>
            <div>
              <div>{b.nombre ?? `Integrante #${b.id}`}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{b.campus} · {b.area} · {b.motivo}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === `b${b.id}`} onClick={() => resolver(`/api/integrantes/solicitudes-baja/${b.id}`, `b${b.id}`, { aprobar: true })}>Aprobar</button>
              <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} disabled={ocupado === `b${b.id}`} onClick={() => resolver(`/api/integrantes/solicitudes-baja/${b.id}`, `b${b.id}`, { aprobar: false })}>Rechazar</button>
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion titulo="Cumpleaños por aprobar" vacio="Sin mensajes pendientes." cantidad={cumples?.length}>
        {cumples?.map((c) => (
          <div className="fila" key={c.id}>
            <div>
              <div>{c.nombres}</div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{c.fecha}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="boton" style={{ padding: "6px 10px", fontSize: "0.82rem" }} disabled={ocupado === `c${c.id}`} onClick={() => resolverCumple(c.id, true)}>Aprobar</button>
              <button style={{ padding: "6px 10px", fontSize: "0.82rem", background: "none", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)" }} disabled={ocupado === `c${c.id}`} onClick={() => resolverCumple(c.id, false)}>Anular</button>
            </div>
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

      <p className="muted" style={{ margin: "20px 0 8px" }}>Gestión completa</p>
      <Link href="/perfiles" className="tarjeta" style={{ display: "block", marginBottom: 12 }}>
        Perfiles — roles, campus y módulos de cada persona →
      </Link>
      <Link href="/cumpleanos" className="tarjeta" style={{ display: "block" }}>
        Cumpleaños — próximos y mensajes →
      </Link>
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
