"use client";

import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { proximaFecha } from "@/lib/sesiones";
import { ENCUENTRO_DE_SERVICIO } from "@/lib/disponibilidad";
import { useCampus } from "@/lib/campus-context";

type Ficha = {
  id: number;
  servicio: string;
  tipo: string;
  area: string;
  fecha: string;
  puesto: string;
  nombre: string | null;
  encargado: string | null;
};

type Cabecera = {
  lider_voluntariado: string | null;
  stand_merch: string | null;
  stand_aplc: string | null;
  cerrada: boolean;
  cerrada_por: string | null;
} | null;

type DatosCabecera = {
  cabecera: Cabecera;
  administradoresCampus: string[];
  pastoresCampus: string[];
  horario: string;
  // Automático desde la planilla técnica en vivo (o fallback manual si no
  // respondió) — ver /api/ficha-cabecera.
  predicador: string;
  siembra: string;
  despedida: string;
  productorGeneral: string;
  encargadosTecnicos: string;
  productorEncuentro: string;
  deTecnica: boolean;
};

const SERVICIOS = ["Jueves 8pm", "Domingo 11am", "Domingo 6pm"] as const;

/** Orden de las áreas en el documento combinado — misma prioridad que trae
 * la ficha real en papel (Administración/Voluntariado primero, luego
 * Kids/Tweens, luego Técnica/Worship). Un área que no esté en esta lista
 * (nueva, o de datos viejos) queda al final, orden alfabético. */
const ORDEN_AREAS = [
  "Administración", "Voluntariado", "Conexión", "Stand de Oración",
  "Kids", "Tweens", "Worship", "Técnica", "Merch",
];

/** Campos que siguen siendo manuales — Predicador/Siembra/Producción ya se
 * copian solos desde la planilla técnica (ver /api/ficha-cabecera). Stand
 * Merch/APLC quedan manuales hasta que esos equipos tengan su propia área
 * con ficha, como ya tiene Voluntariado. */
const CAMPOS_MANUALES: { key: keyof NonNullable<Cabecera>; label: string }[] = [
  { key: "lider_voluntariado", label: "Líderes de Voluntarios" },
  { key: "stand_merch", label: "Stand AR Merch" },
  { key: "stand_aplc", label: "Stand APLC" },
];

function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function FichaCompletaInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { campusActivo: campus } = useCampus();

  const [servicio, setServicio] = useState<(typeof SERVICIOS)[number]>(
    (searchParams.get("servicio") as (typeof SERVICIOS)[number]) || SERVICIOS[0]
  );
  const [fecha, setFecha] = useState(
    searchParams.get("fecha") || proximaFecha(ENCUENTRO_DE_SERVICIO[SERVICIOS[0]])
  );
  const [ficha, setFicha] = useState<Ficha[] | null>(null);
  const [datosCabecera, setDatosCabecera] = useState<DatosCabecera | null>(null);
  const [cargando, setCargando] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const visorRef = useRef<HTMLDivElement>(null);

  const cargarFicha = useCallback(async (serv: string, f: string, c: string) => {
    setCargando(true);
    const [resFicha, resCab] = await Promise.all([
      fetch(`/api/fichas-servicio?servicio=${encodeURIComponent(serv)}&fecha=${encodeURIComponent(f)}`),
      fetch(`/api/ficha-cabecera?servicio=${encodeURIComponent(serv)}&fecha=${encodeURIComponent(f)}&campus=${encodeURIComponent(c)}`),
    ]);
    const [jsonFicha, jsonCab] = await Promise.all([resFicha.json(), resCab.json()]);
    setCargando(false);
    if (!jsonFicha.ok) { setError(jsonFicha.error); return; }
    if (!jsonCab.ok) { setError(jsonCab.error); return; }
    setFicha(jsonFicha.data);
    setDatosCabecera(jsonCab.data);
    const c2 = jsonCab.data.cabecera ?? {};
    setForm({
      lider_voluntariado: c2.lider_voluntariado ?? "",
      stand_merch: c2.stand_merch ?? "",
      stand_aplc: c2.stand_aplc ?? "",
    });
    setError(null);
  }, []);

  useEffect(() => {
    cargarFicha(servicio, fecha, campus);
    router.replace(`/equipos/ficha?servicio=${encodeURIComponent(servicio)}&fecha=${encodeURIComponent(fecha)}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio, fecha, campus, cargarFicha]);

  const porArea = useMemo(() => {
    const grupos = new Map<string, Map<string, { encargado: string; nombres: string[] }>>();
    for (const f of ficha ?? []) {
      if (!grupos.has(f.area)) grupos.set(f.area, new Map());
      const porPuesto = grupos.get(f.area)!;
      const clave = f.puesto.trim();
      if (!porPuesto.has(clave)) porPuesto.set(clave, { encargado: "", nombres: [] });
      const g = porPuesto.get(clave)!;
      if (f.encargado && f.encargado !== "TRUE") g.encargado = f.encargado;
      if (f.nombre?.trim()) g.nombres.push(f.nombre.trim());
    }
    const areas = [...grupos.keys()].sort((a, b) => {
      const ia = ORDEN_AREAS.indexOf(a);
      const ib = ORDEN_AREAS.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "es");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return areas.map((area) => ({
      area,
      puestos: [...grupos.get(area)!.entries()].map(([puesto, g]) => ({ puesto, ...g })),
    }));
  }, [ficha]);

  async function guardarCabecera() {
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/ficha-cabecera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servicio, fecha, ...form }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setEditando(false);
    await cargarFicha(servicio, fecha, campus);
  }

  async function alternarCierre(cerrar: boolean) {
    setCerrando(true);
    setError(null);
    const res = await fetch("/api/ficha-cabecera/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servicio, fecha, cerrada: cerrar }),
    });
    const json = await res.json();
    setCerrando(false);
    if (!json.ok) { setError(json.error); return; }
    await cargarFicha(servicio, fecha, campus);
  }

  async function descargarImagen() {
    if (!visorRef.current) return;
    setGenerandoImagen(true);
    setError(null);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(visorRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("sin blob");
      const nombreArchivo = `Ficha completa - ${servicio} - ${fecha}.png`.replace(/\//g, "-");
      const file = new File([blob], nombreArchivo, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: nombreArchivo });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreArchivo;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("No se pudo generar la imagen. Intenta de nuevo.");
    } finally {
      setGenerandoImagen(false);
    }
  }

  const c = datosCabecera;
  const vacio = (v: string | null | undefined) => (v && v.trim() ? v : "—");

  return (
    <div className="contenedor">
      <p className="muted" style={{ marginBottom: 4 }}>
        <Link href="/equipos" style={{ color: "var(--accent)" }}>← Mi equipo</Link>
      </p>
      <h1 className="titulo">Ficha completa</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Todas las áreas juntas, igual que la ficha en papel.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="campo" style={{ flex: 1, minWidth: 160 }}>
          <label>Servicio</label>
          <select
            value={servicio}
            onChange={(e) => {
              const s = e.target.value as (typeof SERVICIOS)[number];
              setServicio(s);
              setFecha(proximaFecha(ENCUENTRO_DE_SERVICIO[s]));
            }}
          >
            {SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 140 }}>
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {error && <p className="aviso">{error}</p>}
      {cargando && <p className="muted">Cargando…</p>}

      {!cargando && porArea.length === 0 && c?.administradoresCampus.length === 0 && (
        <p className="muted">Sin puestos cargados para {servicio} · {fechaLegible(fecha)} en ninguna área todavía.</p>
      )}

      {!cargando && (porArea.length > 0 || c) && (
        <>
          <div
            ref={visorRef}
            style={{
              background: "#ffffff", color: "#1a1a1a", padding: "24px 22px", borderRadius: 10,
              border: "1px solid #e2e2e2", maxWidth: 520, fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            <div style={{ textAlign: "center", borderBottom: "3px solid #1a1a1a", paddingBottom: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.5 }}>FICHA DE SERVICIO</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>ARM Global · {campus}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}><strong>{servicio}</strong> · {fechaLegible(fecha)}</div>
              {c?.cabecera?.cerrada && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", marginTop: 6, letterSpacing: 0.5 }}>
                  🔒 CERRADA{c.cabecera.cerrada_por ? ` · ${c.cabecera.cerrada_por}` : ""}
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.7 }}>
              <div><b>Fecha:</b> {fechaLegible(fecha)} &nbsp; <b>Horario:</b> {c?.horario || "—"}</div>
              <div><b>Pastores:</b> {c && c.pastoresCampus.length > 0 ? c.pastoresCampus.join(" y ") : "—"}</div>
              <div><b>Administradores de Campus:</b> {c && c.administradoresCampus.length > 0 ? c.administradoresCampus.join(" - ") : "—"}</div>
              <div><b>Líderes de Voluntarios:</b> {vacio(c?.cabecera?.lider_voluntariado)}</div>
            </div>
            {c && !c.deTecnica && (
              <div style={{ fontSize: 11, color: "#b45309", marginBottom: 10 }}>
                No se pudo leer la planilla técnica — Predicador/Siembra/Producción quedan en lo último guardado manual.
              </div>
            )}

            {porArea.map(({ area, puestos }) => (
              <div key={area} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 13, fontWeight: 700, color: "#fff", background: "#1a1a1a",
                    padding: "4px 10px", borderRadius: 4, marginBottom: 8, textTransform: "uppercase",
                  }}
                >
                  {area}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {puestos.map((g) => (
                    <div key={g.puesto} style={{ borderBottom: "1px solid #eee", paddingBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{g.puesto}</div>
                      {g.encargado && <div style={{ fontSize: 11, color: "#777" }}>Encargado: {g.encargado}</div>}
                      <div style={{ fontSize: 13, color: "#333", marginTop: 2 }}>
                        {g.nombres.length > 0 ? g.nombres.join(" · ") : "— sin asignar —"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: 10, marginTop: 4, fontSize: 12, lineHeight: 1.8 }}>
              <div><b>Predicador:</b> {vacio(c?.predicador)}</div>
              <div><b>Siembra, Info y Despedida:</b> Siembra: {vacio(c?.siembra)} — Despedida: {vacio(c?.despedida)}</div>
              <div style={{ marginTop: 6 }}><b>Producción</b></div>
              <div>Productor General: {vacio(c?.productorGeneral)}</div>
              <div>Encargados Técnicos de Campus: {vacio(c?.encargadosTecnicos)}</div>
              <div>Productor Responsable del Encuentro: {vacio(c?.productorEncuentro)}</div>
              <div style={{ marginTop: 6 }}>Stand AR Merch: {vacio(c?.cabecera?.stand_merch)}</div>
              <div>Stand APLC: {vacio(c?.cabecera?.stand_aplc)}</div>
            </div>

            <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginTop: 16 }}>
              Generado desde la app · {new Date().toLocaleDateString("es-CL")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button className="boton" onClick={descargarImagen} disabled={generandoImagen}>
              {generandoImagen ? "Generando…" : "Descargar / compartir imagen"}
            </button>
            <button
              type="button"
              className="boton-secundario"
              style={{ width: "auto", padding: "0 14px" }}
              onClick={() => setEditando((v) => !v)}
            >
              {editando ? "Cerrar edición" : "Editar líder de voluntariado / stands"}
            </button>
            <button
              type="button"
              className="boton-secundario"
              style={{
                width: "auto",
                padding: "0 14px",
                borderColor: datosCabecera?.cabecera?.cerrada ? "#16a34a" : "#b91c1c",
                color: datosCabecera?.cabecera?.cerrada ? "#16a34a" : "#b91c1c",
              }}
              onClick={() => alternarCierre(!datosCabecera?.cabecera?.cerrada)}
              disabled={cerrando}
            >
              {cerrando
                ? "Guardando…"
                : datosCabecera?.cabecera?.cerrada
                ? "Reabrir ficha"
                : "Cerrar ficha"}
            </button>
          </div>

          {datosCabecera?.cabecera?.cerrada && (
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
              La ficha de esta semana está cerrada — ningún líder de área puede editarla hasta que la reabras.
            </p>
          )}

          {editando && (
            <section className="tarjeta stack" style={{ marginTop: 14 }}>
              <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                Predicador, Siembra y Producción ya se copian solos desde la planilla técnica — esto es lo que queda manual.
              </p>
              {CAMPOS_MANUALES.map((campo) => (
                <div className="campo" key={campo.key}>
                  <label>{campo.label}</label>
                  <input
                    value={form[campo.key] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [campo.key]: e.target.value }))}
                    placeholder={campo.key === "lider_voluntariado" ? "Nombre y nombre" : undefined}
                  />
                </div>
              ))}
              <button type="button" className="boton" onClick={guardarCabecera} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function FichaCompletaPage() {
  return (
    <Suspense fallback={<div className="contenedor"><p className="muted">Cargando…</p></div>}>
      <FichaCompletaInner />
    </Suspense>
  );
}
