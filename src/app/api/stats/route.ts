import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api-helpers";
import { CAMPUS, CATEGORIAS, METODOS, ASIS_IDS, VOL_IDS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";

export const dynamic = "force-dynamic";

const TIPOS_ENCUENTRO = ["Jueves PM", "Domingo AM", "Domingo PM", "Evento Especial"];
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

type Item = {
  fecha: string;
  encuentro: string;
  evento: string;
  finalizado: boolean;
  predicador: string;
  modalidad: string;
  responsable: string;
  lideres: string;
  adm: string;
  asis: Record<string, number>;
  vol: Record<string, number>;
  asisTotal: number;
  volTotal: number;
  ninos: number;
  aceptaron: number;
  onAcepto: number;
  onEspect: number;
  aportes: number;
  nAportes: number;
  porCat: Record<string, number>;
  porMetodo: Record<string, number>;
};

function sumaObj(o: Record<string, number>) {
  return Object.values(o).reduce((a, b) => a + b, 0);
}

function contar(mapa: Record<string, { nombre: string; veces: number }>, texto: string | null) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return;
  const k = t.toLowerCase();
  if (!mapa[k]) mapa[k] = { nombre: t, veces: 0 };
  mapa[k].veces++;
}

function ordenar(mapa: Record<string, { nombre: string; veces: number }>) {
  return Object.values(mapa).sort((a, b) => b.veces - a.veces);
}

/** Agrupa los encuentros por día, semana (lunes a domingo) o mes — igual que serie_ de Code.gs. */
function serie(lista: Item[], modo: string) {
  if (modo !== "dia" && modo !== "semana" && modo !== "mes") return [];
  const mapa: Record<string, { clave: string; encuentros: number; asistencia: number; ninos: number; voluntarios: number; aceptaron: number; aportes: number }> = {};
  const orden: string[] = [];
  for (const it of lista) {
    const [y, m, d] = it.fecha.split("-").map(Number);
    let k: string;
    if (modo === "dia") k = it.fecha;
    else if (modo === "mes") k = `${y}-${String(m).padStart(2, "0")}`;
    else {
      const dt = new Date(Date.UTC(y, m - 1, d, 12));
      dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
      k = dt.toISOString().slice(0, 10);
    }
    if (!mapa[k]) {
      mapa[k] = { clave: k, encuentros: 0, asistencia: 0, ninos: 0, voluntarios: 0, aceptaron: 0, aportes: 0 };
      orden.push(k);
    }
    const g = mapa[k];
    g.encuentros++;
    g.asistencia += it.asisTotal;
    g.ninos += it.ninos;
    g.voluntarios += it.volTotal;
    g.aceptaron += it.aceptaron;
    g.aportes += it.aportes;
  }
  orden.sort().reverse();
  return orden.map((k) => mapa[k]);
}

async function statsCampus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campus: (typeof CAMPUS)[number],
  f: { desde: string; hasta: string; tipos: string[]; ultimos: number; agrupar: string }
) {
  let q = supabase
    .from("sesiones")
    .select("key, fecha, encuentro, evento, finalizado, predicador, modalidad, responsable, lideres, adm, aceptaron, on_acepto, on_espect")
    .eq("campus", campus);
  if (f.desde) q = q.gte("fecha", f.desde);
  if (f.hasta) q = q.lte("fecha", f.hasta);
  if (f.tipos.length) q = q.in("encuentro", f.tipos);
  const { data: sesionesRaw, error: errS } = await q;
  if (errS) throw errS;

  const keys = (sesionesRaw ?? []).map((s) => s.key);
  const [{ data: asis }, { data: vol }, { data: aportes }] = await Promise.all([
    keys.length
      ? supabase.from("sesion_asistencia").select("sesion_key, area, cantidad").in("sesion_key", keys)
      : Promise.resolve({ data: [] as { sesion_key: string; area: string; cantidad: number }[] }),
    keys.length
      ? supabase.from("sesion_voluntarios").select("sesion_key, area, cantidad").in("sesion_key", keys)
      : Promise.resolve({ data: [] as { sesion_key: string; area: string; cantidad: number }[] }),
    keys.length
      ? supabase.from("aportes").select("sesion_key, monto, categoria, metodo").in("sesion_key", keys)
      : Promise.resolve({ data: [] as { sesion_key: string; monto: number; categoria: string; metodo: string }[] }),
  ]);

  const sess: Record<string, Item> = {};
  let lista: Item[] = (sesionesRaw ?? [])
    .filter((o) => FECHA_RE.test(o.fecha))
    .map((o) => {
      const asisMap: Record<string, number> = {};
      ASIS_IDS.forEach((x) => (asisMap[x] = 0));
      const volMap: Record<string, number> = {};
      VOL_IDS.forEach((x) => (volMap[x] = 0));
      const porCat: Record<string, number> = {};
      CATEGORIAS.forEach((c) => (porCat[c] = 0));
      const porMetodo: Record<string, number> = {};
      METODOS.forEach((m) => (porMetodo[m] = 0));
      const it: Item = {
        fecha: o.fecha,
        encuentro: o.encuentro,
        evento: o.evento ?? "",
        finalizado: !!o.finalizado,
        predicador: o.predicador ?? "",
        modalidad: o.modalidad ?? "",
        responsable: o.responsable ?? "",
        lideres: o.lideres ?? "",
        adm: o.adm ?? "",
        asis: asisMap,
        vol: volMap,
        asisTotal: 0,
        volTotal: 0,
        ninos: 0,
        aceptaron: o.aceptaron ?? 0,
        onAcepto: o.on_acepto ?? 0,
        onEspect: o.on_espect ?? 0,
        aportes: 0,
        nAportes: 0,
        porCat,
        porMetodo,
      };
      sess[o.key] = it;
      return it;
    });

  for (const row of asis ?? []) {
    const it = sess[row.sesion_key];
    if (!it || !(row.area in it.asis)) continue;
    it.asis[row.area] += row.cantidad;
  }
  for (const row of vol ?? []) {
    const it = sess[row.sesion_key];
    if (!it || !(row.area in it.vol)) continue;
    it.vol[row.area] += row.cantidad;
  }
  for (const it of lista) {
    it.asisTotal = sumaObj(it.asis);
    it.volTotal = sumaObj(it.vol);
    it.ninos = (it.asis["kids"] ?? 0) + (it.asis["tweens"] ?? 0) + (it.asis["bebes"] ?? 0);
  }
  for (const row of aportes ?? []) {
    const it = row.sesion_key ? sess[row.sesion_key] : undefined;
    if (!it) continue;
    const monto = Number(row.monto) || 0;
    it.aportes += monto;
    it.nAportes++;
    if (row.categoria) it.porCat[row.categoria] = (it.porCat[row.categoria] ?? 0) + monto;
    if (row.metodo) it.porMetodo[row.metodo] = (it.porMetodo[row.metodo] ?? 0) + monto;
  }

  lista.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.encuentro < b.encuentro ? -1 : 1));
  if (f.ultimos > 0) lista = lista.slice(0, f.ultimos);

  const porVol: Record<string, number> = {};
  VOL_IDS.forEach((x) => (porVol[x] = 0));
  const porSala: Record<string, number> = {};
  ASIS_IDS.forEach((x) => (porSala[x] = 0));
  const porCat: Record<string, number> = {};
  CATEGORIAS.forEach((c) => (porCat[c] = 0));
  const porMetodo: Record<string, number> = {};
  METODOS.forEach((m) => (porMetodo[m] = 0));
  const predicadores: Record<string, { nombre: string; veces: number }> = {};
  const modalidades: Record<string, { nombre: string; veces: number }> = {};
  const responsables: Record<string, { nombre: string; veces: number }> = {};
  const adms: Record<string, { nombre: string; veces: number }> = {};
  const lideres: Record<string, { nombre: string; veces: number }> = {};

  const R = {
    encuentros: lista.length,
    asistencia: 0,
    ninos: 0,
    voluntarios: 0,
    personas: 0,
    aceptaron: 0,
    aportes: 0,
    nAportes: 0,
    onAcepto: 0,
    onEspect: 0,
  };

  for (const it of lista) {
    R.asistencia += it.asisTotal;
    R.ninos += it.ninos;
    R.voluntarios += it.volTotal;
    R.aceptaron += it.aceptaron;
    R.aportes += it.aportes;
    R.nAportes += it.nAportes;
    for (const c in it.porCat) porCat[c] = (porCat[c] ?? 0) + it.porCat[c];
    for (const m in it.porMetodo) porMetodo[m] = (porMetodo[m] ?? 0) + it.porMetodo[m];
    ASIS_IDS.forEach((k) => (porSala[k] += it.asis[k]));
    VOL_IDS.forEach((k) => (porVol[k] += it.vol[k]));
    R.onAcepto += it.onAcepto;
    R.onEspect += it.onEspect;
    contar(predicadores, it.predicador);
    contar(modalidades, it.modalidad);
    contar(responsables, it.responsable);
    contar(adms, it.adm);
    it.lideres.split(",").forEach((x) => contar(lideres, x));
  }

  R.personas = R.asistencia + R.voluntarios;
  const promAsistencia = R.encuentros ? Math.round(R.asistencia / R.encuentros) : 0;
  const promAportes = R.encuentros ? Math.round(R.aportes / R.encuentros) : 0;

  return {
    campus,
    resumen: {
      ...R,
      porCat,
      porMetodo,
      porSala,
      porVol,
      predicadores: ordenar(predicadores),
      modalidades: ordenar(modalidades),
      responsables: ordenar(responsables),
      adms: ordenar(adms),
      lideres: ordenar(lideres),
      promAsistencia,
      promAportes,
    },
    detalle: lista,
    series: serie(lista, f.agrupar),
  };
}

/**
 * api_stats: estadísticas agregadas por campus (encuentros, asistencia,
 * aportes, series). Gate: solo Pastor o Admin app (verPanorama_ en Code.gs),
 * no RLS por fila — por eso el chequeo de rol es explícito acá.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const roles = (identidad.perfil.roles as string[] | null) ?? [];
  const esPastor = roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor");
  if (!esPastor && !roles.includes("Admin app")) {
    return fail("Tu perfil no tiene acceso a las estadísticas.", 403);
  }

  const { searchParams } = new URL(req.url);
  const desde = FECHA_RE.test(searchParams.get("desde") ?? "") ? searchParams.get("desde")! : "";
  const hasta = FECHA_RE.test(searchParams.get("hasta") ?? "") ? searchParams.get("hasta")! : "";
  const tipos = (searchParams.get("tipos") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => TIPOS_ENCUENTRO.includes(t));
  const ultimos = Math.min(Math.max(0, Number(searchParams.get("ultimos")) || 0), 500);
  const agrupar = ["dia", "semana", "mes"].includes(searchParams.get("agrupar") ?? "") ? searchParams.get("agrupar")! : "";
  const campusParam = searchParams.get("campus");
  const campusLista: (typeof CAMPUS)[number][] | null =
    !campusParam || campusParam === "Ambos"
      ? [...CAMPUS]
      : CAMPUS.includes(campusParam as (typeof CAMPUS)[number])
        ? [campusParam as (typeof CAMPUS)[number]]
        : null;
  if (!campusLista) return fail("Campus no válido.");

  const resultados = await Promise.all(
    campusLista.map((c) => statsCampus(supabase, c, { desde, hasta, tipos, ultimos, agrupar }))
  );

  return ok({ hoy: new Date().toISOString().slice(0, 10), filtros: { desde, hasta, tipos, ultimos, agrupar }, campus: resultados });
}
