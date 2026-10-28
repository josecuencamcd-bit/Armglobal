"use client";

import { useEffect, useState, useCallback } from "react";
import { CAMPUS, AREAS } from "@/lib/sesiones";

const ROLES = [
  "Pastor principal", "Pastor de campus", "Pastor", "Ministro",
  "Administrador", "Líder", "Voluntario", "Admin app",
] as const;

type Perfil = {
  id: string;
  nombre: string;
  correo: string;
  roles: string[];
  areas: string[];
  campus: string | null;
  bloqueado: boolean;
};

type Solicitud = {
  correo: string;
  nombre: string;
  nota: string | null;
  estado: string;
  fecha: string;
};

/**
 * Módulo Perfiles/Accesos: aprobar/rechazar solicitudes de acceso y editar
 * roles/área/campus/bloqueo de cada perfil — equivalente a Soporte →
 * Accesos + Perfiles de la app vieja. Contra /api/perfiles,
 * /api/perfiles/[id] y /api/solicitudes-acceso(/[correo]), ya existentes.
 */
export default function PerfilesPage() {
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [rp, rs] = await Promise.all([fetch("/api/perfiles"), fetch("/api/solicitudes-acceso")]);
    const [jp, js] = await Promise.all([rp.json(), rs.json()]);
    if (!jp.ok) { setError(jp.error); return; }
    setPerfiles(jp.data);
    if (js.ok) setSolicitudes(js.data.filter((s: Solicitud) => s.estado === "Pendiente"));
    setError(null);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function resolver(correo: string, aprobar: boolean) {
    if (!confirm(aprobar ? `¿Aprobar el acceso de ${correo}?` : `¿Rechazar y borrar la cuenta de ${correo}?`)) return;
    const res = await fetch(`/api/solicitudes-acceso/${encodeURIComponent(correo)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobar }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargar();
  }

  async function guardarPerfil(id: string, cambios: Partial<Pick<Perfil, "roles" | "areas" | "campus" | "bloqueado">>) {
    setGuardando(true);
    const res = await fetch(`/api/perfiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setPerfiles((prev) => prev?.map((p) => (p.id === id ? { ...p, ...json.data } : p)) ?? null);
  }

  if (!perfiles && !error) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Perfiles</h1>
      {error && <p className="aviso">{error}</p>}

      {solicitudes && solicitudes.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <p className="muted" style={{ marginBottom: 8 }}>Solicitudes pendientes</p>
          {solicitudes.map((s) => (
            <div className="tarjeta" key={s.correo}>
              <p style={{ fontWeight: 600, margin: 0 }}>{s.nombre}</p>
              <p className="muted" style={{ margin: "2px 0 8px" }}>{s.correo}</p>
              {s.nota && <p style={{ margin: "0 0 10px", fontSize: "0.88rem" }}>{s.nota}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="boton" style={{ flex: 1 }} onClick={() => resolver(s.correo, true)}>
                  Aprobar
                </button>
                <button className="boton-peligro" style={{ flex: 1 }} onClick={() => resolver(s.correo, false)}>
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="muted" style={{ marginBottom: 8 }}>Todos ({perfiles?.length ?? 0})</p>
      {perfiles?.map((p) => (
        <div className="tarjeta" key={p.id}>
          <button
            onClick={() => setAbierto(abierto === p.id ? null : p.id)}
            style={{ width: "100%", background: "none", border: 0, color: "inherit", textAlign: "left", cursor: "pointer", padding: 0 }}
          >
            <div className="fila" style={{ border: 0, padding: 0 }}>
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {p.nombre} {p.bloqueado && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>· bloqueado</span>}
                </p>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                  {p.roles.join(", ") || "Sin rol"} {p.campus ? `· ${p.campus}` : ""}
                </p>
              </div>
              <span className="muted">{abierto === p.id ? "▲" : "▼"}</span>
            </div>
          </button>

          {abierto === p.id && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <p className="muted" style={{ marginBottom: 6, fontSize: "0.8rem" }}>Roles</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {ROLES.map((r) => {
                  const activo = p.roles.includes(r);
                  return (
                    <button
                      key={r}
                      disabled={guardando}
                      onClick={() => {
                        const roles = activo ? p.roles.filter((x) => x !== r) : [...p.roles, r];
                        guardarPerfil(p.id, { roles });
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        border: `1px solid ${activo ? "var(--accent)" : "var(--line)"}`,
                        background: activo ? "var(--accent)" : "transparent",
                        color: activo ? "var(--accent-ink)" : "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              <p className="muted" style={{ marginBottom: 6, fontSize: "0.8rem" }}>Área</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {AREAS.map((a) => {
                  const activo = p.areas.includes(a);
                  return (
                    <button
                      key={a}
                      disabled={guardando}
                      onClick={() => {
                        const areas = activo ? p.areas.filter((x) => x !== a) : [...p.areas, a];
                        guardarPerfil(p.id, { areas });
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        border: `1px solid ${activo ? "var(--accent)" : "var(--line)"}`,
                        background: activo ? "var(--accent)" : "transparent",
                        color: activo ? "var(--accent-ink)" : "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>

              <div className="campo">
                <label>Campus</label>
                <select
                  value={p.campus ?? ""}
                  disabled={guardando}
                  onChange={(e) => guardarPerfil(p.id, { campus: e.target.value || undefined })}
                >
                  <option value="">Sin campus</option>
                  {CAMPUS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button
                className={p.bloqueado ? "boton" : "boton-peligro"}
                disabled={guardando}
                onClick={() => guardarPerfil(p.id, { bloqueado: !p.bloqueado })}
                style={{ width: "100%" }}
              >
                {p.bloqueado ? "Desbloquear acceso" : "Bloquear acceso"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
