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

const SERVICIOS = ["Jueves 8pm", "Domingo 11am", "Domingo 6pm"] as const;

/** Orden de las áreas en el documento combinado — misma prioridad que trae
 * la ficha real en papel (Administración/Voluntariado primero, luego
 * Kids/Tweens, luego Técnica/Worship). Un área que no esté en esta lista
 * (nueva, o de datos viejos) queda al final, orden alfabético. */
const ORDEN_AREAS = [
  "Administración", "Voluntariado", "Conexión", "Stand de Oración",
  "Kids", "Tweens", "Worship", "Técnica", "Merch",
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
  const [cargando, setCargando] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visorRef = useRef<HTMLDivElement>(null);

  const cargarFicha = useCallback(async (serv: string, f: string) => {
    setCargando(true);
    const res = await fetch(`/api/fichas-servicio?servicio=${encodeURIComponent(serv)}&fecha=${encodeURIComponent(f)}`);
    const json = await res.json();
    setCargando(false);
    if (!json.ok) { setError(json.error); return; }
    setFicha(json.data);
  }, []);

  useEffect(() => {
    cargarFicha(servicio, fecha);
    router.replace(`/equipos/ficha?servicio=${encodeURIComponent(servicio)}&fecha=${encodeURIComponent(fecha)}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio, fecha, cargarFicha]);

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

      {!cargando && porArea.length === 0 && (
        <p className="muted">Sin puestos cargados para {servicio} · {fechaLegible(fecha)} en ninguna área todavía.</p>
      )}

      {porArea.length > 0 && (
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
            </div>

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

            <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginTop: 8 }}>
              Generado desde la app · {new Date().toLocaleDateString("es-CL")}
            </div>
          </div>

          <button className="boton" style={{ marginTop: 14 }} onClick={descargarImagen} disabled={generandoImagen}>
            {generandoImagen ? "Generando…" : "Descargar / compartir imagen"}
          </button>
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
