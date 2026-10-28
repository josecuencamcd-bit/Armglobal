"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { MODULOS_APP, DEFAULTS_NOMBRE_MOD, TITULOS_MOD } from "@/lib/modulosApp";

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
  sirve: string[];
  campus: string | null;
  bloqueado: boolean;
  modulos_on: string[];
  modulos_off: string[];
  roles_nuevos: string[] | null;
  areas_nuevas: string[] | null;
  rol_cambia_desde: string | null;
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
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [entrando, setEntrando] = useState<string | null>(null);
  const [nombresMod, setNombresMod] = useState<Record<string, string>>({});
  const [mostrarNombres, setMostrarNombres] = useState(false);

  const cargar = useCallback(async () => {
    const [rp, rs, rn] = await Promise.all([
      fetch("/api/perfiles"),
      fetch("/api/solicitudes-acceso"),
      fetch("/api/nombres-modulo"),
    ]);
    const [jp, js, jn] = await Promise.all([rp.json(), rs.json(), rn.json()]);
    if (!jp.ok) { setError(jp.error); return; }
    setPerfiles(jp.data);
    if (js.ok) setSolicitudes(js.data.filter((s: Solicitud) => s.estado === "Pendiente"));
    if (jn.ok) {
      const mapa: Record<string, string> = {};
      jn.data.forEach((r: { clave: string; nombre: string }) => (mapa[r.clave] = r.nombre));
      setNombresMod(mapa);
    }
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

  async function guardarPerfil(id: string, cambios: Partial<Pick<Perfil, "roles" | "areas" | "sirve" | "campus" | "bloqueado" | "roles_nuevos" | "areas_nuevas" | "rol_cambia_desde">>) {
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

  async function verComo(id: string, nombre: string) {
    if (!confirm(`¿Entrar a la app como ${nombre}? Lo que registres desde ahí va a quedar guardado a su nombre.`)) return;
    setEntrando(id);
    const res = await fetch("/api/admin/impersonar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfilId: id }),
    });
    const json = await res.json();
    setEntrando(null);
    if (!json.ok) { setError(json.error); return; }
    router.push("/inicio");
    router.refresh();
  }

  async function guardarModulosPersona(id: string, modulos_on: string[], modulos_off: string[]) {
    setGuardando(true);
    const res = await fetch(`/api/perfiles/${id}/modulos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulos_on, modulos_off }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setPerfiles((prev) => prev?.map((p) => (p.id === id ? { ...p, ...json.data } : p)) ?? null);
  }

  function toggleModuloPersona(p: Perfil, clave: string) {
    const encendido = p.modulos_on.includes(clave);
    const apagado = p.modulos_off.includes(clave);
    // ciclo: heredado (ninguno) → forzado ON → forzado OFF → heredado
    let on = p.modulos_on, off = p.modulos_off;
    if (!encendido && !apagado) on = [...on, clave];
    else if (encendido) { on = on.filter((x) => x !== clave); off = [...off, clave]; }
    else off = off.filter((x) => x !== clave);
    guardarModulosPersona(p.id, on, off);
  }

  async function guardarNombreModulo(clave: string, nombre: string) {
    const actual = nombresMod[clave] ?? DEFAULTS_NOMBRE_MOD[clave];
    if (!nombre.trim() || nombre === actual) return;
    const res = await fetch("/api/nombres-modulo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, nombre: nombre.trim() }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setNombresMod((prev) => ({ ...prev, [clave]: nombre.trim() }));
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

      <section className="tarjeta" style={{ marginBottom: 20 }}>
        <button
          onClick={() => setMostrarNombres((v) => !v)}
          style={{ width: "100%", background: "none", border: 0, color: "inherit", textAlign: "left", cursor: "pointer", padding: 0, fontWeight: 600 }}
        >
          Nombres de módulo {mostrarNombres ? "▲" : "▼"}
        </button>
        {mostrarNombres && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.keys(DEFAULTS_NOMBRE_MOD).map((clave) => (
              <div className="campo" key={clave} style={{ marginBottom: 0 }}>
                <label>{DEFAULTS_NOMBRE_MOD[clave]}</label>
                <input
                  defaultValue={nombresMod[clave] ?? DEFAULTS_NOMBRE_MOD[clave]}
                  onBlur={(e) => guardarNombreModulo(clave, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

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

              <ProgramarRol perfil={p} guardando={guardando} onGuardar={guardarPerfil} />

              <p className="muted" style={{ marginBottom: 6, fontSize: "0.8rem" }}>Área que lidera</p>
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

              <p className="muted" style={{ marginBottom: 6, fontSize: "0.8rem" }}>Otras áreas donde sirve como voluntario</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {AREAS.map((a) => {
                  const activo = p.sirve.includes(a);
                  return (
                    <button
                      key={a}
                      disabled={guardando}
                      onClick={() => {
                        const sirve = activo ? p.sirve.filter((x) => x !== a) : [...p.sirve, a];
                        guardarPerfil(p.id, { sirve });
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
                  onChange={(e) => guardarPerfil(p.id, { campus: e.target.value ? e.target.value : null })}
                >
                  <option value="">Todos los campus (elige al entrar)</option>
                  {CAMPUS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button
                className="boton-secundario"
                style={{ marginBottom: 14 }}
                disabled={entrando === p.id}
                onClick={() => verComo(p.id, p.nombre)}
              >
                {entrando === p.id ? "Entrando…" : `Ver la app como ${p.nombre.split(" ")[0]}`}
              </button>

              <p className="muted" style={{ marginBottom: 6, fontSize: "0.8rem" }}>
                Módulos activados a mano (además de los que le da su rol)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {MODULOS_APP.map((m) => {
                  const encendido = p.modulos_on.includes(m);
                  const apagado = p.modulos_off.includes(m);
                  return (
                    <button
                      key={m}
                      disabled={guardando}
                      onClick={() => toggleModuloPersona(p, m)}
                      title={encendido ? "Forzado encendido — toca para apagarlo" : apagado ? "Forzado apagado — toca para volver a heredar del rol" : "Según su rol — toca para forzar encendido"}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: "0.75rem",
                        border: `1px solid ${encendido ? "var(--ok)" : apagado ? "var(--danger)" : "var(--line)"}`,
                        background: encendido ? "var(--ok)" : apagado ? "transparent" : "transparent",
                        color: encendido ? "#0a1f14" : apagado ? "var(--danger)" : "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      {nombresMod[m] ?? TITULOS_MOD[m]}
                    </button>
                  );
                })}
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

/** Cambio de rol programado — equivalente a la "autonomía" de la app
 * vieja donde una persona quedaba con un rol nuevo automáticamente a
 * partir de una fecha (ej. "desde noviembre pasa a Líder"). Se guarda en
 * roles_nuevos/rol_cambia_desde y lo aplica solo la función
 * aplicar_roles_programados() (cron diario + cada vez que se abre
 * Perfiles) — nadie tiene que volver a tocarlo ese día. */
function ProgramarRol({
  perfil,
  guardando,
  onGuardar,
}: {
  perfil: Perfil;
  guardando: boolean;
  onGuardar: (id: string, cambios: { roles_nuevos?: string[] | null; rol_cambia_desde?: string | null }) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [roles, setRoles] = useState<string[]>(perfil.roles_nuevos ?? perfil.roles);
  const [fecha, setFecha] = useState(perfil.rol_cambia_desde ?? "");

  const pendiente = !!perfil.rol_cambia_desde && !!perfil.roles_nuevos?.length;

  if (!abierto && !pendiente) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{ background: "none", border: 0, color: "var(--accent)", fontSize: "0.8rem", cursor: "pointer", padding: 0, marginBottom: 14 }}
      >
        Programar cambio de rol desde una fecha
      </button>
    );
  }

  if (pendiente && !abierto) {
    return (
      <div className="tarjeta" style={{ margin: "0 0 14px", padding: 10 }}>
        <p style={{ margin: 0, fontSize: "0.82rem" }}>
          Cambia a <strong>{perfil.roles_nuevos!.join(", ")}</strong> desde el {perfil.rol_cambia_desde}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button type="button" onClick={() => setAbierto(true)} style={{ background: "none", border: 0, color: "var(--accent)", fontSize: "0.78rem", cursor: "pointer", padding: 0 }}>
            Editar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => onGuardar(perfil.id, { roles_nuevos: null, rol_cambia_desde: null })}
            style={{ background: "none", border: 0, color: "var(--muted)", fontSize: "0.78rem", cursor: "pointer", padding: 0 }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tarjeta" style={{ margin: "0 0 14px", padding: 10 }}>
      <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.78rem" }}>Nuevos roles desde…</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {ROLES.map((r) => {
          const activo = roles.includes(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRoles(activo ? roles.filter((x) => x !== r) : [...roles, r])}
              style={{
                padding: "6px 10px", borderRadius: 999, fontSize: "0.75rem",
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
      <div className="campo">
        <label>Desde</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="boton"
          style={{ flex: 1 }}
          disabled={guardando || !fecha || roles.length === 0}
          onClick={() => {
            onGuardar(perfil.id, { roles_nuevos: roles, rol_cambia_desde: fecha });
            setAbierto(false);
          }}
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          style={{ flex: 1, background: "none", border: "1px solid var(--line)", borderRadius: 10, color: "var(--muted)", cursor: "pointer" }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
