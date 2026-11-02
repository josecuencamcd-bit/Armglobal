"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icono } from "@/lib/iconos";

type Acceso = { correo: string; nombre: string; nota: string | null; estado: string };
type AutEncuentro = { id: number; nombre: string; campus: string; encuentro: string; fecha: string; motivo: string; estado: string };
type AutFondos = { id: number; solicitante: string | null; campus: string; area: string; mes: string; motivo: string; estado: string };

const TILES: { key: string; label: string; icon: string; href?: string }[] = [
  { key: "accesos", label: "Accesos", icon: "soporte" },
  { key: "perfiles", label: "Perfiles", icon: "perfiles", href: "/perfiles" },
  { key: "fondos", label: "Fondos", icon: "fondo", href: "/fondos" },
  { key: "cumpleanos", label: "Cumpleaños", icon: "cumples", href: "/cumpleanos" },
  { key: "turnos", label: "Turnos", icon: "turnos", href: "/turnos" },
  { key: "nombres", label: "Nombres", icon: "perfiles", href: "/soporte/nombres" },
  { key: "actividad", label: "Actividad", icon: "actividad", href: "/actividad" },
];

/** Soporte: mismo menú de la app vieja (grilla Accesos/Perfiles/Fondos/
 * Cumpleaños/Turnos/Nombres), mostrando UNA sección a la vez — igual que
 * vSoporte() (tabsPorRol + dispatch), no todas juntas. "Accesos" es la
 * única que se resuelve en esta misma pantalla (solicitudes de acceso +
 * reaperturas, que no tienen otro lugar en el nav); el resto de los tiles
 * son atajos a su propio módulo completo. Los saludos de cumpleaños por
 * aprobar y los últimos enviados viven en /cumpleanos (tile "Cumpleaños"),
 * no acá — tenerlos duplicados en las dos pantallas era el bug real. */
export default function SoportePage() {
  const router = useRouter();
  const [accesos, setAccesos] = useState<Acceso[] | null>(null);
  const [autEnc, setAutEnc] = useState<AutEncuentro[] | null>(null);
  const [autFon, setAutFon] = useState<AutFondos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [ra, rae, raf] = await Promise.all([
      fetch("/api/solicitudes-acceso"),
      fetch("/api/autorizaciones"),
      fetch("/api/fondos/autorizaciones"),
    ]);
    const [ja, jae, jaf] = await Promise.all([ra.json(), rae.json(), raf.json()]);
    if (ja.ok) setAccesos(ja.data.filter((x: Acceso) => x.estado === "Pendiente"));
    if (jae.ok) setAutEnc(jae.data.filter((x: AutEncuentro) => x.estado === "Pendiente"));
    if (jaf.ok) setAutFon(jaf.data.filter((x: AutFondos) => x.estado === "Pendiente Pastor" || x.estado === "Pendiente Admin"));
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
