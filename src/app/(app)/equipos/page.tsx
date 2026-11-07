"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { AREAS, TALLAS, proximaFecha } from "@/lib/sesiones";
import { useCampus } from "@/lib/campus-context";
import { VolverAdministracion } from "@/lib/volver-admin";
import { AREAS_DISPONIBILIDAD, ENCUENTRO_DE_SERVICIO } from "@/lib/disponibilidad";

type Integrante = {
  id: number;
  campus: string;
  area: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  estado: string;
  nacimiento: string | null;
  anos_iglesia: number | null;
  anos_servicio: number | null;
  rol_servicio: string | null;
  profesion: string | null;
  talla_polera: string | null;
  talla_poleron: string | null;
  /** Equipos además del principal (Camino 2) — alguien que sirve en más de
   * un equipo y responde la encuesta de disponibilidad por cada uno. */
  equipos_extra: string[];
  /** true cuando esta área NO es su equipo principal — está acá porque un
   * líder lo vinculó desde "Agregar integrante" (equipo-extra) o desde la
   * edición de otro integrante. Su área principal sigue siendo otra. */
  es_extra?: boolean;
};

/** Solicitud de polera/polerón para un integrante — cualquier líder la
 * arma desde su equipo, el líder de Merch (o Finanzas) la resuelve. */
type SolicitudMerch = {
  id: number;
  campus: string;
  area: string;
  integrante_id: number | null;
  solicitante: string;
  tipo: string;
  talla: string;
  cantidad: number;
  metodo_pago: string;
  comprobante_url: string | null;
  estado: string;
  nota: string | null;
  creado_en: string;
};

/** Días que faltan para el próximo cumpleaños (0 = hoy), igual criterio
 * que /api/cumpleanos pero acotado a la lista ya cargada de esta área. */
function diasHastaCumple(nacimiento: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) return null;
  const [, , mesStr, diaStr] = m;
  const hoy = new Date();
  const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let d = Date.UTC(hoy.getFullYear(), +mesStr - 1, +diaStr);
  if (d < base) d = Date.UTC(hoy.getFullYear() + 1, +mesStr - 1, +diaStr);
  return Math.round((d - base) / 86_400_000);
}

/** Convierte el archivo elegido (foto del comprobante de pago) a un jpeg
 * en base64, redimensionado para quedar bien debajo del límite de 8MB de
 * subirFotoJpeg() — mismo formato que espera /api/merch/solicitudes. */
function archivoAJpegDataUrl(file: File, maxDim = 1600, calidad = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No se pudo procesar la imagen.")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function promedio(valores: (number | null)[]): number | null {
  const nums = valores.filter((v): v is number => v != null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

type SolicitudBaja = { id: number; integrante_id: number | null; estado: string };

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

type PersonaDisponible = { id: number; nombre: string };
type ResumenEncuentro = { clave: string; fecha: string; etiqueta: string; disponibles: PersonaDisponible[] };
type ResumenDisponibilidad = {
  semana: string;
  porEncuentro: ResumenEncuentro[];
  sinDisponibilidad: PersonaDisponible[];
  totalRespondieron: number;
};

/** Equivalente a FICHA_HOJAS/FICHA_AREAS de Code.gs: antes se sincronizaba
 * sola desde una hoja de cálculo externa (Ficha) cada hora; acá el líder la
 * carga a mano desde "Mi equipo" (api_fichaActualizar → /api/fichas-servicio). */
const SERVICIOS = ["Jueves 8pm", "Domingo 11am", "Domingo 6pm"] as const;
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Módulo Equipos (= "Mi equipo"/integrantes) — equivalente a api_ecoEquipo*
 * de la app vieja, contra /api/integrantes(/[id]), ya existentes. */
export default function EquiposPage() {
  const { campusActivo: campus, puedeElegir, elegirCampus } = useCampus();
  const [area, setArea] = useState<(typeof AREAS)[number]>(AREAS[0]);
  const [lista, setLista] = useState<Integrante[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<{ id: number; nombre: string; area: string }[]>([]);
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [editando, setEditando] = useState<Integrante | null>(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [bajasPendientes, setBajasPendientes] = useState<Set<number>>(new Set());
  const [pidiendoBaja, setPidiendoBaja] = useState<number | null>(null);
  const [enviandoBaja, setEnviandoBaja] = useState(false);

  const [servicio, setServicio] = useState<(typeof SERVICIOS)[number]>(SERVICIOS[0]);
  const [fechaFicha, setFechaFicha] = useState(() => proximaFecha(ENCUENTRO_DE_SERVICIO[SERVICIOS[0]]));
  const [fechaTocada, setFechaTocada] = useState(false);
  const [ficha, setFicha] = useState<Ficha[] | null>(null);
  const [mostrarFormFicha, setMostrarFormFicha] = useState(false);
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  const [resumen, setResumen] = useState<ResumenDisponibilidad | null>(null);
  const [revelado, setRevelado] = useState<string | null>(null);
  const [nombrePuesto, setNombrePuesto] = useState("");
  const [nombreLibre, setNombreLibre] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [otroEquipoAbierto, setOtroEquipoAbierto] = useState(false);
  const [otroEquipoArea, setOtroEquipoArea] = useState<(typeof AREAS)[number]>(AREAS[0]);
  const [otroEquipoLista, setOtroEquipoLista] = useState<PersonaDisponible[] | null>(null);
  const [cargandoOtroEquipo, setCargandoOtroEquipo] = useState(false);

  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const vistaPreviaRef = useRef<HTMLDivElement>(null);

  // Solicitud de polera/polerón (cualquier líder, para un integrante de su
  // propio equipo) y, cuando area === "Merch", el panel de revisión.
  const [pidiendoMerch, setPidiendoMerch] = useState<number | null>(null);
  const [enviandoMerch, setEnviandoMerch] = useState(false);
  const [errorMerch, setErrorMerch] = useState<string | null>(null);
  const [solicitudesMerch, setSolicitudesMerch] = useState<SolicitudMerch[] | null>(null);
  const [resolviendoId, setResolviendoId] = useState<number | null>(null);
  const [comprobanteVisto, setComprobanteVisto] = useState<{ id: number; url: string } | null>(null);

  const cargar = useCallback(async (c: string, a: string) => {
    const [res, resBajas] = await Promise.all([
      fetch(`/api/integrantes?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`),
      fetch(`/api/integrantes/solicitudes-baja?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`),
    ]);
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    setLista(json.data);
    setError(null);
    const jsonBajas = await resBajas.json();
    if (jsonBajas.ok) {
      setBajasPendientes(new Set(
        (jsonBajas.data as SolicitudBaja[])
          .filter((s) => s.estado === "Pendiente" && s.integrante_id != null)
          .map((s) => s.integrante_id as number)
      ));
    }
  }, []);

  const cargarFicha = useCallback(async (a: string, serv: string, f: string) => {
    const res = await fetch(
      `/api/fichas-servicio?servicio=${encodeURIComponent(serv)}&tipo=${encodeURIComponent(a)}&fecha=${encodeURIComponent(f)}`
    );
    const json = await res.json();
    if (!json.ok) return;
    setFicha(json.data.filter((x: Ficha) => x.area === a));
  }, []);

  /** Quién respondió la encuesta de disponibilidad de esta semana para este
   * equipo — solo existe para los 6 equipos con encuesta (AREAS_DISPONIBILIDAD);
   * Stand de Oración y Administración no la tienen, así que el resumen queda
   * vacío ahí y la ficha vuelve a aceptar nombre libre. */
  const cargarResumen = useCallback(async (c: string, a: string) => {
    if (!AREAS_DISPONIBILIDAD.includes(a as (typeof AREAS_DISPONIBILIDAD)[number])) {
      setResumen(null);
      return;
    }
    const res = await fetch(`/api/disponibilidad/resumen?campus=${encodeURIComponent(c)}&area=${encodeURIComponent(a)}`);
    const json = await res.json();
    if (!json.ok) { setResumen(null); return; }
    setResumen(json.data);
  }, []);

  /** Panel de revisión del líder de Merch: todas las solicitudes pendientes
   * de cualquier equipo — merch_solicitudes_select ya deja ver todo a
   * quien tiene área "Merch" (o Finanzas); un líder de otra área solo verá
   * las propias, así que esto no tiene sentido fuera de area === "Merch". */
  const cargarSolicitudesMerch = useCallback(async (c: string) => {
    const res = await fetch(`/api/merch/solicitudes?campus=${encodeURIComponent(c)}`);
    const json = await res.json();
    if (!json.ok) return;
    setSolicitudesMerch(json.data);
  }, []);

  useEffect(() => {
    cargar(campus, area);
    cargarResumen(campus, area);
  }, [campus, area, cargar, cargarResumen]);

  useEffect(() => {
    if (area === "Merch") cargarSolicitudesMerch(campus);
    else setSolicitudesMerch(null);
  }, [campus, area, cargarSolicitudesMerch]);

  async function pedirMerch(i: Integrante, fd: FormData) {
    setEnviandoMerch(true);
    setErrorMerch(null);
    try {
      let comprobante: string | undefined;
      const archivo = fd.get("comprobante") as File | null;
      if (archivo && archivo.size > 0) comprobante = await archivoAJpegDataUrl(archivo);

      const res = await fetch("/api/merch/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campus,
          area,
          integrante_id: i.id,
          tipo: fd.get("tipo"),
          talla: fd.get("talla"),
          cantidad: Number(fd.get("cantidad") || 1),
          metodo_pago: fd.get("metodo_pago"),
          comprobante,
        }),
      });
      const json = await res.json();
      if (!json.ok) { setErrorMerch(json.error); return; }
      setPidiendoMerch(null);
    } catch (e) {
      setErrorMerch(e instanceof Error ? e.message : "No se pudo enviar la solicitud.");
    } finally {
      setEnviandoMerch(false);
    }
  }

  async function resolverSolicitud(id: number, estado: "Aprobada" | "Rechazada" | "Entregada") {
    setResolviendoId(id);
    const res = await fetch(`/api/merch/solicitudes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    setResolviendoId(null);
    if (!json.ok) { setErrorMerch(json.error); return; }
    await cargarSolicitudesMerch(campus);
  }

  async function verComprobante(id: number) {
    const res = await fetch(`/api/merch/solicitudes/${id}/foto`);
    const json = await res.json();
    if (!json.ok) { setErrorMerch(json.error); return; }
    setComprobanteVisto({ id, url: json.data.url });
  }

  useEffect(() => {
    cargarFicha(area, servicio, fechaFicha);
  }, [area, servicio, fechaFicha, cargarFicha]);

  // Al cambiar de servicio, la fecha salta a la próxima ocurrencia real de
  // ese día (jueves/domingo que viene) en vez de quedarse en una fecha vieja
  // — así la ficha "empieza vacía" automáticamente cada semana, porque
  // fichas_servicio se guarda por fecha real y una fecha nueva no trae nada.
  // Si el líder toca la fecha a mano, respeta su elección.
  useEffect(() => {
    if (fechaTocada) return;
    setFechaFicha(proximaFecha(ENCUENTRO_DE_SERVICIO[servicio]));
  }, [servicio, fechaTocada]);

  // Encuentro de disponibilidad que corresponde al servicio elegido, y
  // quiénes están disponibles ahí, sin contar a quien ya quedó asignado a
  // algún puesto de esta misma ficha (para no repetir a la misma persona).
  const yaAsignados = useMemo(
    () => new Set((ficha ?? []).map((f) => f.nombre?.trim()).filter((n): n is string => Boolean(n))),
    [ficha]
  );
  const disponiblesServicio = useMemo(() => {
    const clave = ENCUENTRO_DE_SERVICIO[servicio];
    const lista = resumen?.porEncuentro.find((e) => e.clave === clave)?.disponibles ?? [];
    return lista.filter((p) => !yaAsignados.has(p.nombre.trim()));
  }, [resumen, servicio, yaAsignados]);
  const idsDisponiblesServicio = useMemo(
    () => new Set(disponiblesServicio.map((p) => p.id)),
    [disponiblesServicio]
  );

  /** Todo el equipo del área (no solo quienes respondieron la encuesta), con
   * los disponibles para este servicio primero — así el líder puede asignar
   * a alguien aunque no haya respondido, tal como lo pidió. */
  const equipoOrdenado = useMemo(() => {
    const activos = (lista ?? []).filter(
      (i) => i.estado !== "Baja" && !yaAsignados.has(i.nombre.trim())
    );
    return [...activos].sort((a, b) => {
      const da = idsDisponiblesServicio.has(a.id) ? 0 : 1;
      const db = idsDisponiblesServicio.has(b.id) ? 0 : 1;
      if (da !== db) return da - db;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [lista, idsDisponiblesServicio, yaAsignados]);

  useEffect(() => {
    if (!otroEquipoAbierto) return;
    setCargandoOtroEquipo(true);
    fetch(`/api/integrantes/roster-equipo?campus=${encodeURIComponent(campus)}&area=${encodeURIComponent(otroEquipoArea)}`)
      .then((r) => r.json())
      .then((j) => setOtroEquipoLista(j.ok ? j.data : []))
      .catch(() => setOtroEquipoLista([]))
      .finally(() => setCargandoOtroEquipo(false));
  }, [otroEquipoAbierto, otroEquipoArea, campus]);

  // Agrupa las filas de la ficha por puesto (igual que la ficha real, donde
  // "Acomodadores" aparece una sola vez con 1-3 nombres) para la vista
  // previa / imagen que se comparte por WhatsApp.
  const puestosAgrupados = useMemo(() => {
    const orden: string[] = [];
    const porPuesto = new Map<string, { encargado: string; nombres: string[] }>();
    for (const f of ficha ?? []) {
      const clave = f.puesto.trim();
      if (!porPuesto.has(clave)) {
        orden.push(clave);
        porPuesto.set(clave, { encargado: "", nombres: [] });
      }
      const g = porPuesto.get(clave)!;
      if (f.encargado) g.encargado = f.encargado;
      if (f.nombre?.trim()) g.nombres.push(f.nombre.trim());
    }
    return orden.map((puesto) => ({ puesto, ...porPuesto.get(puesto)! }));
  }, [ficha]);

  function fechaLegibleFicha(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  async function descargarImagenFicha() {
    if (!vistaPreviaRef.current) return;
    setGenerandoImagen(true);
    setError(null);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(vistaPreviaRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("sin blob");
      const nombreArchivo = `Ficha ${area} - ${servicio} - ${fechaFicha}.png`.replace(/\//g, "-");
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
      setError("No se pudo generar la imagen de la ficha. Intenta de nuevo.");
    } finally {
      setGenerandoImagen(false);
    }
  }

  async function crearFicha(fd: FormData) {
    const puesto = String(fd.get("puesto") ?? "").trim();
    const yaEnEstePuesto = (ficha ?? []).filter(
      (f) => f.puesto.trim().toLowerCase() === puesto.toLowerCase()
    ).length;
    if (yaEnEstePuesto >= 3) {
      setError(`"${puesto}" ya tiene 3 personas asignadas — ese es el máximo por puesto.`);
      return;
    }
    const nombre = nombreLibre ? String(fd.get("nombre") ?? "").trim() : nombrePuesto;
    setGuardandoFicha(true);
    const res = await fetch("/api/fichas-servicio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        servicio,
        tipo: area,
        area,
        fecha: fechaFicha,
        puesto,
        nombre: nombre || undefined,
        encargado: fd.get("encargado") || undefined,
      }),
    });
    const json = await res.json();
    setGuardandoFicha(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarFormFicha(false);
    setNombrePuesto("");
    setNombreLibre(false);
    setSelectorAbierto(false);
    setOtroEquipoAbierto(false);
    await cargarFicha(area, servicio, fechaFicha);
  }

  async function editarNombreFicha(id: number, nombre: string) {
    const res = await fetch(`/api/fichas-servicio/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error); return; }
    await cargarFicha(area, servicio, fechaFicha);
  }

  // Buscador cruzado al escribir el nombre en "Agregar integrante": si la
  // persona ya existe en otro equipo, se ofrece vincularla (equipo_extra)
  // en vez de crear un duplicado — pedido explícito de José Miguel.
  useEffect(() => {
    if (!mostrarForm || nombreNuevo.trim().length < 2) { setResultadosBusqueda([]); return; }
    const t = setTimeout(() => {
      setBuscandoPersona(true);
      fetch(`/api/integrantes/buscar?campus=${encodeURIComponent(campus)}&q=${encodeURIComponent(nombreNuevo.trim())}&excluirArea=${encodeURIComponent(area)}`)
        .then((r) => r.json())
        .then((j) => setResultadosBusqueda(j.ok ? j.data : []))
        .catch(() => setResultadosBusqueda([]))
        .finally(() => setBuscandoPersona(false));
    }, 350);
    return () => clearTimeout(t);
  }, [mostrarForm, nombreNuevo, campus, area]);

  async function vincularExistente(persona: { id: number; nombre: string }) {
    setVinculando(true);
    const res = await fetch(`/api/integrantes/${persona.id}/equipo-extra`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area }),
    });
    const json = await res.json();
    setVinculando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    setNombreNuevo("");
    setResultadosBusqueda([]);
    await cargar(campus, area);
  }

  async function crear(fd: FormData) {
    setGuardando(true);
    const res = await fetch("/api/integrantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campus,
        area,
        nombre: fd.get("nombre"),
        telefono: fd.get("telefono") || undefined,
        correo: fd.get("correo") || undefined,
        nacimiento: fd.get("nacimiento") || undefined,
        anos_iglesia: fd.get("anos_iglesia") ? Number(fd.get("anos_iglesia")) : undefined,
        anos_servicio: fd.get("anos_servicio") ? Number(fd.get("anos_servicio")) : undefined,
        rol_servicio: fd.get("rol_servicio") || undefined,
        talla_polera: fd.get("talla_polera") || undefined,
        talla_poleron: fd.get("talla_poleron") || undefined,
      }),
    });
    const json = await res.json();
    setGuardando(false);
    if (!json.ok) { setError(json.error); return; }
    setMostrarForm(false);
    setNombreNuevo("");
    setResultadosBusqueda([]);
    await cargar(campus, area);
  }

  async function guardarEdicion(fd: FormData) {
    if (!editando) return;
    setGuardandoEdit(true);
    const res = await fetch(`/api/integrantes/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: fd.get("nombre"),
        telefono: fd.get("telefono") || undefined,
        correo: fd.get("correo") || undefined,
        area: fd.get("area"),
        nacimiento: fd.get("nacimiento") || undefined,
        anos_iglesia: fd.get("anos_iglesia") ? Number(fd.get("anos_iglesia")) : undefined,
        anos_servicio: fd.get("anos_servicio") ? Number(fd.get("anos_servicio")) : undefined,
        rol_servicio: fd.get("rol_servicio") || undefined,
        talla_polera: fd.get("talla_polera") || undefined,
        talla_poleron: fd.get("talla_poleron") || undefined,
        equipos_extra: fd.getAll("equipos_extra"),
      }),
    });
    const json = await res.json();
    setGuardandoEdit(false);
    if (!json.ok) { setError(json.error); return; }
    setEditando(null);
    await cargar(campus, area);
  }

  /** api_ecoSolBaja: un líder NUNCA da de baja directo — pide la baja con
   * motivo y el Administrador la aprueba desde /bajas (vSolicitudes de la
   * app vieja). Antes acá se llamaba DELETE /api/integrantes/[id] directo,
   * saltándose por completo esa aprobación. */
  async function solicitarBaja(i: Integrante, motivo: string) {
    if (!motivo.trim()) { setError("Falta el motivo de la baja."); return; }
    setEnviandoBaja(true);
    const res = await fetch("/api/integrantes/solicitudes-baja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integrante_id: i.id, campus: i.campus, area: i.area, nombre: i.nombre, motivo }),
    });
    const json = await res.json();
    setEnviandoBaja(false);
    if (!json.ok) { setError(json.error); return; }
    setPidiendoBaja(null);
    await cargar(campus, area);
  }

  if (!lista && !error) return <div className="contenedor">Cargando…</div>;

  const activos = lista?.filter((i) => i.estado === "Activo") ?? [];
  const promIglesia = promedio(activos.map((i) => i.anos_iglesia));
  const promServicio = promedio(activos.map((i) => i.anos_servicio));
  const proximosCumples = activos
    .map((i) => ({ i, dias: i.nacimiento ? diasHastaCumple(i.nacimiento) : null }))
    .filter((x): x is { i: Integrante; dias: number } => x.dias != null)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 5);
  const porRol = new Map<string, Integrante[]>();
  for (const i of activos) {
    const rol = i.rol_servicio?.trim() || "Sin asignar";
    porRol.set(rol, [...(porRol.get(rol) ?? []), i]);
  }

  return (
    <div className="contenedor" style={{ paddingTop: 24 }}>
      <VolverAdministracion />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="titulo" style={{ fontSize: "1.3rem" }}>Equipos</h1>
        <span className="muted" style={{ fontSize: "0.82rem" }}>
          {campus}
          {puedeElegir && (
            <button type="button" onClick={elegirCampus} style={{ background: "none", border: 0, color: "var(--accent)", marginLeft: 6, cursor: "pointer", padding: 0, font: "inherit" }}>
              cambiar
            </button>
          )}
        </span>
      </div>
      {error && <p className="aviso">{error}</p>}

      <div className="campo">
        <label>Área</label>
        <select value={area} onChange={(e) => setArea(e.target.value as (typeof AREAS)[number])}>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {area === "Merch" && (
        <div className="tarjeta stack" style={{ marginBottom: 16 }}>
          <span className="label">Solicitudes de polera / polerón</span>
          {errorMerch && <p className="aviso">{errorMerch}</p>}
          {!solicitudesMerch && <p className="muted">Cargando…</p>}
          {solicitudesMerch && solicitudesMerch.length === 0 && (
            <p className="muted">No hay solicitudes.</p>
          )}
          {solicitudesMerch?.map((s) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="eco-row">
                <div>
                  <b>{s.tipo} {s.talla} × {s.cantidad}</b>
                  <small>{s.area} · pidió {s.solicitante} · {s.metodo_pago}</small>
                  {s.nota && <small>Nota: {s.nota}</small>}
                </div>
                <span className={`eco-badge ${s.estado === "Aprobada" || s.estado === "Entregada" ? "ok" : s.estado === "Rechazada" ? "bad" : "warn"}`}>
                  {s.estado}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {s.comprobante_url && (
                  <button type="button" className="boton-secundario" onClick={() => verComprobante(s.id)}>
                    Ver comprobante
                  </button>
                )}
                {s.estado === "Pendiente" && (
                  <>
                    <button
                      type="button"
                      className="boton-secundario"
                      disabled={resolviendoId === s.id}
                      onClick={() => resolverSolicitud(s.id, "Rechazada")}
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      className="boton"
                      disabled={resolviendoId === s.id}
                      onClick={() => resolverSolicitud(s.id, "Aprobada")}
                    >
                      {resolviendoId === s.id ? "…" : "Aprobar"}
                    </button>
                  </>
                )}
                {s.estado === "Aprobada" && (
                  <button
                    type="button"
                    className="boton"
                    disabled={resolviendoId === s.id}
                    onClick={() => resolverSolicitud(s.id, "Entregada")}
                  >
                    {resolviendoId === s.id ? "…" : "Marcar entregada"}
                  </button>
                )}
              </div>
              {comprobanteVisto?.id === s.id && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={comprobanteVisto.url} alt="Comprobante de pago" style={{ maxWidth: "100%", borderRadius: 8 }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="eco-cards" style={{ marginBottom: 16 }}>
        <div className="eco-card"><span>Integrantes</span><b>{activos.length}</b></div>
        <div className="eco-card"><span>Años en la iglesia (prom.)</span><b>{promIglesia ?? "—"}</b></div>
        <div className="eco-card"><span>Años sirviendo (prom.)</span><b>{promServicio ?? "—"}</b></div>
      </div>

      {proximosCumples.length > 0 && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>CUMPLEAÑOS PRÓXIMOS</p>
          {proximosCumples.map(({ i, dias }) => (
            <p key={i.id} style={{ margin: "4px 0", fontSize: "0.85rem" }}>
              {i.nombre} <span className="muted">· {dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`}</span>
            </p>
          ))}
        </div>
      )}

      {porRol.size > 0 && (
        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: "0.75rem" }}>QUÉ HACE CADA UNO</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...porRol.entries()].map(([rol, personas]) => (
              <span
                key={rol}
                title={personas.map((p) => p.nombre).join(", ")}
                style={{
                  background: "var(--glass-2)", border: "1px solid var(--hud-line)", borderRadius: 999,
                  fontSize: "0.78rem", padding: "5px 10px", fontWeight: 600,
                }}
              >
                {rol} · {personas.length}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        className="boton"
        style={{ marginBottom: 16 }}
        onClick={() => {
          setMostrarForm((v) => !v);
          setNombreNuevo("");
          setResultadosBusqueda([]);
        }}
      >
        {mostrarForm ? "Cerrar" : "Agregar integrante"}
      </button>

      {mostrarForm && (
        <form className="tarjeta" action={(fd) => crear(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="campo">
            <div className="buscador">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                name="nombre"
                required
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Buscar"
                autoComplete="off"
              />
            </div>
            {buscandoPersona && <p className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>Buscando…</p>}
            {!buscandoPersona && resultadosBusqueda.length > 0 && (
              <div className="tarjeta" style={{ marginTop: 8, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
                  Ya existe en otro equipo — toca para agregarla a {area} también, sin duplicarla:
                </p>
                {resultadosBusqueda.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="fila"
                    style={{
                      justifyContent: "flex-start", width: "100%", background: "none",
                      border: "none", borderBottom: "1px solid var(--line)", font: "inherit",
                      color: "inherit", cursor: "pointer", textAlign: "left",
                    }}
                    disabled={vinculando}
                    onClick={() => vincularExistente(p)}
                  >
                    {p.nombre} <span className="muted" style={{ fontSize: "0.75rem", marginLeft: 6 }}>({p.area})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="campo">
            <label>Teléfono</label>
            <input name="telefono" />
          </div>
          <div className="campo">
            <label>Correo</label>
            <input name="correo" type="email" />
          </div>
          <div className="campo">
            <label>Fecha de nacimiento (opcional)</label>
            <input name="nacimiento" type="date" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Años en la iglesia</label>
              <input name="anos_iglesia" type="number" min={0} max={120} />
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Años sirviendo</label>
              <input name="anos_servicio" type="number" min={0} max={120} />
            </div>
          </div>
          <div className="campo">
            <label>Qué hace / rol de servicio (opcional)</label>
            <input name="rol_servicio" placeholder="Ej: Sonido, Cámaras, Bienvenida…" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Talla polera</label>
              <select name="talla_polera" defaultValue="">
                <option value="">—</option>
                {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Talla polerón</label>
              <select name="talla_poleron" defaultValue="">
                <option value="">—</option>
                {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button className="boton" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}

      {lista?.filter((i) => i.estado === "Activo").length === 0 && (
        <p className="muted">Sin integrantes activos en {area} · {campus}.</p>
      )}
      {lista?.filter((i) => i.estado === "Activo").map((i) => {
        const sub = [
          i.profesion,
          i.rol_servicio,
          `${i.anos_servicio ?? 0} ${i.anos_servicio === 1 ? "año" : "años"} sirviendo`,
          `${i.anos_iglesia ?? 0} ${i.anos_iglesia === 1 ? "año" : "años"} en la iglesia`,
          i.talla_polera ? `Polera ${i.talla_polera}` : null,
          i.talla_poleron ? `Polerón ${i.talla_poleron}` : null,
        ].filter(Boolean).join(" · ");
        return (
        <div key={i.id}>
          <div className="fila">
            <div>
              <div>
                {i.nombre}
                {i.es_extra && (
                  <span
                    className="chip"
                    style={{ marginLeft: 8, fontSize: "0.72rem", padding: "2px 8px", minHeight: "auto", verticalAlign: "middle" }}
                  >
                    Equipo adicional · principal: {i.area}
                  </span>
                )}
              </div>
              <div className="muted" style={{ fontSize: "0.78rem" }}>{sub}</div>
              {(i.telefono || i.correo) && <div className="muted" style={{ fontSize: "0.76rem" }}>{i.telefono || i.correo}</div>}
              {i.equipos_extra.length > 0 && (
                <div className="muted" style={{ fontSize: "0.76rem" }}>También sirve en: {i.equipos_extra.join(", ")}</div>
              )}
            </div>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="boton-secundario" onClick={() => setEditando(editando?.id === i.id ? null : i)}>
                {editando?.id === i.id ? "Cerrar" : "Editar"}
              </button>
              <button
                className="boton-secundario"
                onClick={() => { setErrorMerch(null); setPidiendoMerch(pidiendoMerch === i.id ? null : i.id); }}
              >
                {pidiendoMerch === i.id ? "Cerrar" : "Pedir polera/polerón"}
              </button>
              {!bajasPendientes.has(i.id) && (
                <button className="boton-peligro" onClick={() => setPidiendoBaja(pidiendoBaja === i.id ? null : i.id)}>
                  Solicitar baja
                </button>
              )}
            </span>
          </div>
          {bajasPendientes.has(i.id) && (
            <p className="muted" style={{ fontSize: "0.78rem", margin: "-6px 0 10px" }}>
              Solicitud de baja pendiente de aprobación.
            </p>
          )}
          {pidiendoMerch === i.id && (
            <form
              className="tarjeta"
              style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}
              action={(fd) => pedirMerch(i, fd)}
            >
              {errorMerch && <p className="aviso">{errorMerch}</p>}
              <div style={{ display: "flex", gap: 10 }}>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Prenda</label>
                  <select name="tipo" defaultValue="Polera">
                    <option value="Polera">Polera</option>
                    <option value="Polerón">Polerón</option>
                  </select>
                </div>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Talla</label>
                  <select name="talla" defaultValue={i.talla_polera ?? i.talla_poleron ?? "M"}>
                    {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="campo" style={{ width: 80 }}>
                  <label>Cant.</label>
                  <input name="cantidad" type="number" min={1} max={50} defaultValue={1} />
                </div>
              </div>
              <div className="campo">
                <label>Cómo se pagó</label>
                <select name="metodo_pago" defaultValue="Efectivo">
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>
              <div className="campo">
                <label>Comprobante de pago (foto, opcional)</label>
                <input name="comprobante" type="file" accept="image/*" capture="environment" />
              </div>
              <button className="boton" type="submit" disabled={enviandoMerch}>
                {enviandoMerch ? "Enviando…" : "Enviar solicitud a Merch"}
              </button>
            </form>
          )}
          {pidiendoBaja === i.id && (
            <form
              className="tarjeta"
              style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}
              action={(fd) => solicitarBaja(i, String(fd.get("motivo") ?? ""))}
            >
              <div className="campo">
                <label>Motivo de la baja</label>
                <input name="motivo" required autoFocus />
              </div>
              <button className="boton-peligro" type="submit" disabled={enviandoBaja}>
                {enviandoBaja ? "Enviando…" : "Enviar solicitud"}
              </button>
            </form>
          )}
          {editando?.id === i.id && (
            <form className="tarjeta" action={(fd) => guardarEdicion(fd)} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              <div className="campo">
                <label>Nombre</label>
                <input name="nombre" defaultValue={i.nombre} required />
              </div>
              <div className="campo">
                <label>Teléfono</label>
                <input name="telefono" defaultValue={i.telefono ?? ""} />
              </div>
              <div className="campo">
                <label>Correo</label>
                <input name="correo" type="email" defaultValue={i.correo ?? ""} />
              </div>
              <div className="campo">
                <label>Área</label>
                <select name="area" defaultValue={i.area}>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="campo">
                <label>También sirve en (equipos adicionales)</label>
                <div className="chips">
                  {AREAS.filter((a) => a !== i.area).map((a) => (
                    <label
                      key={a}
                      className="chip"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        name="equipos_extra"
                        value={a}
                        defaultChecked={i.equipos_extra.includes(a)}
                        style={{ margin: 0 }}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
              <div className="campo">
                <label>Fecha de nacimiento (opcional)</label>
                <input name="nacimiento" type="date" defaultValue={i.nacimiento ?? ""} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Años en la iglesia</label>
                  <input name="anos_iglesia" type="number" min={0} max={120} defaultValue={i.anos_iglesia ?? ""} />
                </div>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Años sirviendo</label>
                  <input name="anos_servicio" type="number" min={0} max={120} defaultValue={i.anos_servicio ?? ""} />
                </div>
              </div>
              <div className="campo">
                <label>Qué hace / rol de servicio (opcional)</label>
                <input name="rol_servicio" defaultValue={i.rol_servicio ?? ""} placeholder="Ej: Sonido, Cámaras, Bienvenida…" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Talla polera</label>
                  <select name="talla_polera" defaultValue={i.talla_polera ?? ""}>
                    <option value="">—</option>
                    {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Talla polerón</label>
                  <select name="talla_poleron" defaultValue={i.talla_poleron ?? ""}>
                    <option value="">—</option>
                    {TALLAS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button className="boton" type="submit" disabled={guardandoEdit}>
                {guardandoEdit ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
          )}
        </div>
        );
      })}

      <h2 className="titulo" style={{ fontSize: "1.05rem", marginTop: 28 }}>Ficha de servicio</h2>
      <p className="muted" style={{ fontSize: "0.82rem", marginTop: -8 }}>
        Quién sirve en {area} para un servicio y fecha puntual.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="campo" style={{ flex: 1, minWidth: 160 }}>
          <label>Servicio</label>
          <select
            value={servicio}
            onChange={(e) => {
              setServicio(e.target.value as (typeof SERVICIOS)[number]);
              setFechaTocada(false);
            }}
          >
            {SERVICIOS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 140 }}>
          <label>Fecha</label>
          <input
            type="date"
            value={fechaFicha}
            onChange={(e) => { setFechaTocada(true); setFechaFicha(e.target.value); }}
          />
        </div>
      </div>

      {resumen && (
        <div className="tarjeta" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Disponibilidad de esta semana ({resumen.totalRespondieron} respondieron) — toca para ver los nombres.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {resumen.porEncuentro.map((e) => (
              <button
                key={e.clave}
                type="button"
                className="chip"
                aria-pressed={revelado === e.clave}
                onClick={() => setRevelado((v) => (v === e.clave ? null : e.clave))}
              >
                {e.etiqueta.replace(/^\w+ /, "")}: {e.disponibles.length} disponibles
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-pressed={revelado === "sin"}
              onClick={() => setRevelado((v) => (v === "sin" ? null : "sin"))}
            >
              Sin disponibilidad: {resumen.sinDisponibilidad.length}
            </button>
          </div>
          {revelado && revelado !== "sin" && (
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              {resumen.porEncuentro.find((e) => e.clave === revelado)?.disponibles.map((p) => p.nombre).join(", ") || "Nadie respondió todavía."}
            </div>
          )}
          {revelado === "sin" && (
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              {resumen.sinDisponibilidad.map((p) => p.nombre).join(", ") || "Nadie marcó esta opción."}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="boton" onClick={() => setMostrarFormFicha((v) => !v)}>
          {mostrarFormFicha ? "Cerrar" : "Agregar puesto"}
        </button>
        <button className="boton" onClick={() => setMostrarVistaPrevia((v) => !v)} disabled={ficha?.length === 0}>
          {mostrarVistaPrevia ? "Ocultar vista previa" : "Vista previa / imagen"}
        </button>
      </div>

      {mostrarFormFicha && (
        <form className="tarjeta" action={(fd) => crearFicha(fd)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="campo">
            <label>Puesto</label>
            <input name="puesto" required />
          </div>
          <div className="campo">
            <label>Nombre</label>
            <button
              type="button"
              className="chip"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => setSelectorAbierto((v) => !v)}
            >
              {nombrePuesto || "— tocar para elegir persona —"}
            </button>

            {selectorAbierto && (
              <div className="tarjeta" style={{ marginTop: 8, padding: 10, display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                {equipoOrdenado.length === 0 && (
                  <p className="muted" style={{ fontSize: "0.8rem" }}>Sin personas en {area} para elegir.</p>
                )}
                {equipoOrdenado.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="fila"
                    style={{
                      justifyContent: "flex-start", gap: 8, width: "100%", background: "none",
                      border: "none", borderBottom: "1px solid var(--line)", font: "inherit",
                      color: "inherit", cursor: "pointer", textAlign: "left",
                    }}
                    onClick={() => { setNombrePuesto(p.nombre); setSelectorAbierto(false); setNombreLibre(false); }}
                  >
                    <span
                      style={{
                        display: "inline-block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: idsDisponiblesServicio.has(p.id) ? "#2ecc71" : "transparent",
                        border: idsDisponiblesServicio.has(p.id) ? "none" : "1px solid #999",
                      }}
                      title={idsDisponiblesServicio.has(p.id) ? "Respondió disponible" : "No respondió"}
                    />
                    {p.nombre}
                  </button>
                ))}

                <button
                  type="button"
                  className="chip"
                  style={{ marginTop: 6, width: "fit-content" }}
                  onClick={() => setOtroEquipoAbierto((v) => {
                    if (!v && otroEquipoArea === area) {
                      const otra = AREAS.find((a) => a !== area);
                      if (otra) setOtroEquipoArea(otra);
                    }
                    return !v;
                  })}
                >
                  {otroEquipoAbierto ? "Ocultar otro equipo" : "Otro equipo"}
                </button>

                {otroEquipoAbierto && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <select value={otroEquipoArea} onChange={(e) => setOtroEquipoArea(e.target.value as (typeof AREAS)[number])}>
                      {AREAS.filter((a) => a !== area).map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    {cargandoOtroEquipo && <p className="muted" style={{ fontSize: "0.8rem" }}>Cargando…</p>}
                    {!cargandoOtroEquipo && (otroEquipoLista ?? [])
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="fila"
                          style={{
                            justifyContent: "flex-start", width: "100%", background: "none",
                            border: "none", borderBottom: "1px solid var(--line)", font: "inherit",
                            color: "inherit", cursor: "pointer", textAlign: "left",
                          }}
                          onClick={() => { setNombrePuesto(p.nombre); setSelectorAbierto(false); setOtroEquipoAbierto(false); setNombreLibre(false); }}
                        >
                          {p.nombre} <span className="muted" style={{ fontSize: "0.75rem", marginLeft: 6 }}>({otroEquipoArea})</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {nombreLibre && (
              <input
                name="nombre"
                value={nombrePuesto}
                onChange={(e) => setNombrePuesto(e.target.value)}
                placeholder="Nombre"
                style={{ marginTop: 8 }}
              />
            )}
            <button
              type="button"
              className="chip"
              style={{ marginTop: 6, width: "fit-content" }}
              onClick={() => { setNombreLibre((v) => !v); setNombrePuesto(""); setSelectorAbierto(false); }}
            >
              {nombreLibre ? "Elegir de la lista" : "Escribir otro nombre"}
            </button>
          </div>
          <div className="campo">
            <label>Encargado</label>
            <input name="encargado" />
          </div>
          <button className="boton" type="submit" disabled={guardandoFicha}>
            {guardandoFicha ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}

      {mostrarVistaPrevia && ficha && ficha.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div
            ref={vistaPreviaRef}
            style={{
              background: "#ffffff",
              color: "#1a1a1a",
              padding: "24px 22px",
              borderRadius: 10,
              border: "1px solid #e2e2e2",
              maxWidth: 460,
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            <div style={{ textAlign: "center", borderBottom: "3px solid #1a1a1a", paddingBottom: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>FICHA DE SERVICIO</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>ARM Global · {campus}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14, color: "#333" }}>
              <span><strong>{servicio}</strong></span>
              <span>{fechaLegibleFicha(fechaFicha)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 10, textTransform: "uppercase" }}>
              {area}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {puestosAgrupados.map((g) => (
                <div key={g.puesto} style={{ borderBottom: "1px solid #eee", paddingBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{g.puesto}</div>
                  {g.encargado && (
                    <div style={{ fontSize: 11, color: "#777" }}>Encargado: {g.encargado}</div>
                  )}
                  <div style={{ fontSize: 13, color: "#333", marginTop: 2 }}>
                    {g.nombres.length > 0 ? g.nombres.join(" · ") : "— sin asignar —"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", marginTop: 16 }}>
              Generado desde la app · {new Date().toLocaleDateString("es-CL")}
            </div>
          </div>
          <button
            className="boton"
            style={{ marginTop: 10 }}
            onClick={descargarImagenFicha}
            disabled={generandoImagen}
          >
            {generandoImagen ? "Generando…" : "Descargar / compartir imagen"}
          </button>
          <p style={{ marginTop: 10 }}>
            <Link
              href={`/equipos/ficha?servicio=${encodeURIComponent(servicio)}&fecha=${encodeURIComponent(fechaFicha)}`}
              style={{ color: "var(--accent)", fontSize: "0.9rem" }}
            >
              Ver ficha completa (todas las áreas) →
            </Link>
          </p>
        </div>
      )}

      {ficha?.length === 0 && (
        <p className="muted">Sin puestos cargados para {servicio} · {fechaFicha}.</p>
      )}
      {ficha?.map((f) => (
        <div className="fila" key={f.id}>
          <div>
            <div>{f.puesto}</div>
            <div className="muted" style={{ fontSize: "0.78rem" }}>{f.encargado || ""}</div>
          </div>
          <input
            defaultValue={f.nombre ?? ""}
            placeholder="Nombre"
            style={{ maxWidth: 160 }}
            onBlur={(e) => {
              if (e.target.value !== (f.nombre ?? "")) editarNombreFicha(f.id, e.target.value);
            }}
          />
        </div>
      ))}
    </div>
  );
}
