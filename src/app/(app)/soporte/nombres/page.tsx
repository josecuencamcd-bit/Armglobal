"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Mismas claves/orden que DEFAULTS_NOMBRE_MOD del client.js viejo — el
 * nombre "base" que se muestra como referencia junto al campo editable. */
const BASE: Record<string, string> = {
  panorama: "Panorama",
  stats: "Estadísticas del campus",
  equipo: "Mi equipo",
  asistencia: "Asistencia",
  visitas: "Conexión",
  solicitudes: "Bajas",
  fondo: "Fondo de equipo",
  finanzas: "Finanzas",
  informe: "Informe",
  equipostats: "Estadísticas del equipo",
  reuniones: "Reuniones",
  miperfil: "Mi perfil",
  cumples: "Cumpleaños",
  soporte: "Soporte",
  aportes: "Aportes",
  reporte: "Reporte",
};
const CLAVES = Object.keys(BASE);

/**
 * Soporte > Nombres: puerto 1:1 de vNombresModulo() del client.js viejo —
 * el Admin app cambia el texto de cualquier botón/módulo de la app; el
 * cambio es global (todos los perfiles lo ven). Antes el tile "Nombres"
 * de Soporte apuntaba por error a /perfiles (gestión de usuarios, nada que
 * ver) — esta pantalla faltaba por completo en la migración.
 */
export default function NombresModuloPage() {
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/nombres-modulo");
      const json = await res.json();
      if (json.ok) {
        const mapa: Record<string, string> = {};
        for (const fila of json.data as { clave: string; nombre: string }[]) mapa[fila.clave] = fila.nombre;
        setNombres(mapa);
        setValores(mapa);
      }
      setCargado(true);
    })();
  }, []);

  async function guardar(clave: string) {
    setGuardando(clave);
    setError(null);
    const nombre = (valores[clave] ?? "").trim();
    const res = await fetch("/api/nombres-modulo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, nombre: nombre || BASE[clave] }),
    });
    const json = await res.json();
    setGuardando(null);
    if (!json.ok) { setError(json.error); return; }
    setNombres((n) => ({ ...n, [clave]: nombre }));
  }

  return (
    <div className="contenedor" style={{ paddingTop: 20 }}>
      <Link href="/soporte" className="muted" style={{ fontSize: "0.82rem", textDecoration: "none" }}>
        ‹ Soporte
      </Link>
      <h1 className="titulo" style={{ fontSize: "1.2rem", margin: "4px 0 16px" }}>Nombres</h1>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.85rem" }}>
        Cambia el texto de cualquier botón de la app. El cambio es global, para todos los perfiles.
      </p>
      {error && <p className="aviso">{error}</p>}
      {!cargado && <p className="muted">Cargando…</p>}

      {cargado && CLAVES.map((clave) => {
        const guardado = nombres[clave] ?? "";
        return (
          <div className="tarjeta" key={clave}>
            <div className="campo" style={{ marginBottom: 10 }}>
              <label>Nombre original: {BASE[clave]}</label>
              <input
                type="text"
                maxLength={40}
                value={valores[clave] ?? ""}
                placeholder={guardado || BASE[clave]}
                onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))}
              />
            </div>
            <button
              type="button"
              className="boton-secundario"
              disabled={guardando === clave}
              onClick={() => guardar(clave)}
            >
              Guardar
            </button>
          </div>
        );
      })}
    </div>
  );
}
