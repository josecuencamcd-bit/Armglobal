"use client";

import { useEffect, useState, useCallback } from "react";
import { proximaFecha } from "@/lib/sesiones";
import { SERVICIO_DE_ENCUENTRO } from "@/lib/disponibilidad";

type TuServicio = { servicio: string; fecha: string; area: string; puesto: string };

type IntegranteMini = {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  nacimiento: string | null;
  anos_iglesia: number | null;
  anos_servicio: number | null;
  rol_servicio: string | null;
  profesion: string | null;
  talla_polera: string | null;
  talla_poleron: string | null;
  foto_url: string | null;
};

function fechaCL(iso: string | null) {
  if (!iso) return null;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Reduce la imagen a un cuadrado chico y la comprime a JPEG hasta entrar
 * en el mismo tope de 45000 caracteres que acepta /api/integrantes/[id]/foto
 * (igual que la foto de "Mi perfil"). */
async function fotoADataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const lado = 320;
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  const escala = Math.max(lado / bitmap.width, lado / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (lado - w) / 2, (lado - h) / 2, w, h);
  for (const calidad of [0.8, 0.6, 0.4, 0.25]) {
    const url = canvas.toDataURL("image/jpeg", calidad);
    if (url.length <= 45_000) return url;
  }
  throw new Error("La foto es muy pesada. Prueba con otra.");
}

function Avatar({ nombre, foto, size = 40 }: { nombre: string; foto: string | null; size?: number }) {
  return foto ? (
    <img src={foto} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: "var(--gold-grad)", color: "var(--accent-ink)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.38,
      }}
    >
      {iniciales(nombre)}
    </div>
  );
}

function PerfilModal({ persona, onCerrar, onActualizado }: { persona: IntegranteMini; onCerrar: () => void; onActualizado: (p: IntegranteMini) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subirFoto(file: File) {
    setSubiendo(true);
    setError(null);
    try {
      const foto_url = await fotoADataUrl(file);
      const res = await fetch(`/api/integrantes/${persona.id}/foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto_url }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      onActualizado(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto() {
    setSubiendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrantes/${persona.id}/foto`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      onActualizado(json.data);
    } finally {
      setSubiendo(false);
    }
  }

  const cumple = fechaCL(persona.nacimiento);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onCerrar}
    >
      <div className="tarjeta" style={{ width: "100%", maxWidth: 480, borderRadius: "16px 16px 0 0", maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <Avatar nombre={persona.nombre} foto={persona.foto_url} size={64} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "1.05rem" }}>{persona.nombre}</p>
            {persona.rol_servicio && <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.82rem" }}>{persona.rol_servicio}</p>}
          </div>
        </div>

        <label className="boton-secundario" style={{ display: "inline-block", fontSize: "0.8rem", cursor: "pointer", marginRight: 8 }}>
          {subiendo ? "Subiendo…" : persona.foto_url ? "Cambiar foto" : "Agregar foto"}
          <input
            type="file"
            accept="image/*"
            disabled={subiendo}
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }}
          />
        </label>
        {persona.foto_url && (
          <button type="button" className="boton-peligro" style={{ width: "auto", fontSize: "0.8rem" }} disabled={subiendo} onClick={quitarFoto}>
            Quitar foto
          </button>
        )}
        {error && <p className="aviso" style={{ marginTop: 8 }}>{error}</p>}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, fontSize: "0.86rem" }}>
          {persona.telefono && <p style={{ margin: 0 }}><span className="muted">Teléfono: </span>{persona.telefono}</p>}
          {persona.correo && <p style={{ margin: 0 }}><span className="muted">Correo: </span>{persona.correo}</p>}
          {cumple && <p style={{ margin: 0 }}><span className="muted">Cumpleaños: </span>{cumple}</p>}
          {persona.profesion && <p style={{ margin: 0 }}><span className="muted">Profesión: </span>{persona.profesion}</p>}
          {persona.anos_iglesia != null && <p style={{ margin: 0 }}><span className="muted">Años en la iglesia: </span>{persona.anos_iglesia}</p>}
          {persona.anos_servicio != null && <p style={{ margin: 0 }}><span className="muted">Años sirviendo: </span>{persona.anos_servicio}</p>}
          {(persona.talla_polera || persona.talla_poleron) && (
            <p style={{ margin: 0 }}><span className="muted">Talla polera/polerón: </span>{persona.talla_polera ?? "—"} / {persona.talla_poleron ?? "—"}</p>
          )}
        </div>

        <button type="button" className="boton-secundario" style={{ marginTop: 18 }} onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}

/**
 * Vista de solo lectura de "Mi equipo" para quien SIRVE o FORMA PARTE de
 * uno o más equipos (perfil.areas/sirve) pero no los lidera: por cada
 * equipo del que forma parte, lista a sus compañeros (sin botones de
 * gestión) — tocar a alguien abre su perfil, con foto si tiene y la
 * opción de agregarle una.
 */
export default function VistaMiembro({ campus, areas }: { campus: string; areas: string[] }) {
  const [porArea, setPorArea] = useState<Record<string, IntegranteMini[]> | null>(null);
  const [lideresPorArea, setLideresPorArea] = useState<Record<string, string[]>>({});
  const [misServicios, setMisServicios] = useState<TuServicio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<{ area: string; persona: IntegranteMini } | null>(null);

  const cargar = useCallback(async () => {
    const [resultados, resultadosLideres] = await Promise.all([
      Promise.all(
        areas.map(async (a) => {
          const res = await fetch(`/api/integrantes?campus=${encodeURIComponent(campus)}&area=${encodeURIComponent(a)}`);
          const json = await res.json();
          return [a, json.ok ? (json.data as IntegranteMini[]) : []] as const;
        })
      ),
      Promise.all(
        areas.map(async (a) => {
          const res = await fetch(`/api/integrantes/lideres-equipo?campus=${encodeURIComponent(campus)}&area=${encodeURIComponent(a)}`);
          const json = await res.json();
          return [a, json.ok ? (json.data as string[]) : []] as const;
        })
      ),
    ]);
    setPorArea(Object.fromEntries(resultados));
    setLideresPorArea(Object.fromEntries(resultadosLideres));
    setError(null);
  }, [campus, areas]);

  // "Tu próximo servicio": de las 3 fichas de la semana (Jueves/Domingo AM/
  // Domingo PM), busca filas donde el nombre coincida con el propio —
  // fichas_servicio es de lectura abierta, así que no hace falta una ruta
  // nueva; solo cruzar con el nombre que ya trae /api/perfil.
  useEffect(() => {
    fetch("/api/perfil").then((r) => r.json()).then(async (jPerfil) => {
      if (!jPerfil.ok) return;
      const miNombre = (jPerfil.data.nombre as string | undefined)?.trim().toLowerCase();
      if (!miNombre) return;
      const resultados = await Promise.all(
        Object.entries(SERVICIO_DE_ENCUENTRO).map(async ([encuentro, servicio]) => {
          const fecha = proximaFecha(encuentro);
          const res = await fetch(`/api/fichas-servicio?servicio=${encodeURIComponent(servicio)}&fecha=${fecha}`);
          const json = await res.json();
          if (!json.ok) return [];
          return (json.data as { servicio: string; fecha: string; area: string; puesto: string; nombre: string | null }[])
            .filter((f) => f.nombre?.trim().toLowerCase() === miNombre)
            .map((f) => ({ servicio: f.servicio, fecha: f.fecha, area: f.area, puesto: f.puesto }));
        })
      );
      setMisServicios(resultados.flat());
    });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!porArea) return <div className="contenedor">Cargando…</div>;

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <h1 className="titulo" style={{ fontSize: "1.3rem", margin: "0 0 4px" }}>Mi equipo</h1>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.82rem" }}>Campus {campus}</p>
      {error && <p className="aviso">{error}</p>}

      {misServicios.length > 0 && (
        <div className="tarjeta" style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Tu próximo servicio</p>
          {misServicios.map((s, i) => (
            <p key={i} style={{ margin: "0 0 4px", fontSize: "0.86rem" }}>
              <b>{s.servicio}</b> ({new Date(`${s.fecha}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}) · {s.area} · {s.puesto}
            </p>
          ))}
        </div>
      )}

      {areas.map((area) => {
        const lideres = new Set((lideresPorArea[area] ?? []).map((n) => n.trim().toLowerCase()));
        return (
          <div key={area} className="tarjeta" style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700 }}>{area}</p>
            {(porArea[area] ?? []).length === 0 && <p className="muted" style={{ fontSize: "0.82rem" }}>Sin compañeros cargados todavía.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(porArea[area] ?? []).map((p) => {
                const esLider = lideres.has(p.nombre.trim().toLowerCase());
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSeleccionado({ area, persona: p })}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                      padding: "8px 4px", background: "none", border: "none", cursor: "pointer", color: "inherit",
                    }}
                  >
                    <Avatar nombre={p.nombre} foto={p.foto_url} />
                    <span style={{ fontWeight: esLider ? 700 : 400 }}>{p.nombre}</span>
                    {esLider && (
                      <span className="chip" style={{ fontSize: "0.68rem", padding: "2px 8px", minHeight: "auto" }}>Líder</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {seleccionado && (
        <PerfilModal
          persona={seleccionado.persona}
          onCerrar={() => setSeleccionado(null)}
          onActualizado={(actualizado) => {
            setPorArea((prev) => {
              if (!prev) return prev;
              const lista = (prev[seleccionado.area] ?? []).map((p) => (p.id === actualizado.id ? actualizado : p));
              return { ...prev, [seleccionado.area]: lista };
            });
            setSeleccionado({ area: seleccionado.area, persona: actualizado });
          }}
        />
      )}
    </div>
  );
}
