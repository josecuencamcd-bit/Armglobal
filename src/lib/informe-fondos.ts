import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CAMPUS, AREAS, ENCUENTROS, DIA, hoy } from "./sesiones";

type DB = SupabaseClient<Database>;
type Campus = (typeof CAMPUS)[number];
type Area = (typeof AREAS)[number];

/** campusFin_: si el usuario tiene campus fijo, siempre gana el suyo —
 * el parámetro solo se respeta cuando el perfil ve "todos" (campus NULL). */
export function campusFin(perfilCampus: Campus | null, campusParam: string | null): Campus {
  if (perfilCampus === null) {
    return CAMPUS.includes(campusParam as Campus) ? (campusParam as Campus) : CAMPUS[0];
  }
  return perfilCampus;
}

export function mesOk(mes: string | null): string {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
}

export function mesAnt(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1, 12)).toISOString().slice(0, 7);
}

export function pctCambio(actual: number, anterior: number): number {
  return anterior ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : actual ? 100 : 0;
}

/** ingresosCampus_: ingresos del campus en un mes, sacados de los aportes
 * registrados en los encuentros (tabla `aportes`, no `fondos_equipo`). */
export async function ingresosCampus(db: DB, campus: Campus, mes: string) {
  const { data, error } = await db.from("aportes").select("fecha, monto, categoria, metodo").eq("campus", campus);
  if (error) throw error;
  const cat: Record<string, number> = {};
  const met: Record<string, number> = {};
  let total = 0,
    cuenta = 0,
    antes = 0;
  for (const r of data ?? []) {
    const f = r.fecha.slice(0, 10);
    const m = Number(r.monto) || 0;
    if (f.slice(0, 7) < mes) {
      antes += m;
      continue;
    }
    if (f.slice(0, 7) !== mes) continue;
    cat[r.categoria] = (cat[r.categoria] ?? 0) + m;
    met[r.metodo] = (met[r.metodo] ?? 0) + m;
    total += m;
    cuenta++;
  }
  return { total, cuenta, porCategoria: cat, porMetodo: met, antes };
}

type FilaFondo = {
  id: number;
  fecha: string;
  nombre: string | null;
  monto: number;
  metodo: string | null;
  comercio: string | null;
  boleta: string | null;
  descripcion: string | null;
  categoria: string | null;
  foto_url: string | null;
  por: string | null;
  anulado: boolean;
  tardio: boolean;
  motivo: string;
  anuladoPor: string;
  anuladoEn: string;
};

/** fondoResumen_: resumen de un fondo de equipo (o "Campus" para los
 * aportes extraordinarios) en un mes, con el saldo que arrastra de antes. */
export async function fondoResumen(db: DB, campus: Campus, mes: string, area: Area | "Campus") {
  const { data, error } = await db.from("fondos_equipo").select("*").eq("campus", campus).eq("area", area);
  if (error) throw error;

  let anterior = 0;
  const aportes: FilaFondo[] = [];
  const gastos: FilaFondo[] = [];
  const fechas: string[] = [];
  for (const x of data ?? []) {
    const f = x.fecha.slice(0, 10);
    const m = Number(x.monto) || 0;
    fechas.push(f);
    const anu = x.estado === "Anulado";
    const fila: FilaFondo = {
      id: x.id,
      fecha: f,
      nombre: x.nombre,
      monto: m,
      metodo: x.metodo,
      comercio: x.comercio,
      boleta: x.boleta,
      descripcion: x.descripcion,
      categoria: x.categoria ?? "",
      foto_url: x.foto_url,
      por: x.por,
      anulado: anu,
      tardio: !!x.tardio,
      motivo: x.motivo ?? "",
      anuladoPor: x.anulado_por ?? "",
      anuladoEn: x.anulado_en ?? "",
    };
    if (f.slice(0, 7) < mes) {
      if (!anu) anterior += x.tipo === "aporte" ? m : -m;
    } else if (f.slice(0, 7) === mes) {
      (x.tipo === "aporte" ? aportes : gastos).push(fila);
    }
  }
  const ord = (a: FilaFondo, b: FilaFondo) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
  aportes.sort(ord);
  gastos.sort(ord);

  let ingresos = 0,
    egresos = 0;
  const porMetodo: Record<string, number> = { Efectivo: 0, Transferencia: 0 };
  const porCategoria: Record<string, number> = {};
  for (const x of aportes) {
    if (x.anulado) continue;
    ingresos += x.monto;
    if (x.metodo) porMetodo[x.metodo] = (porMetodo[x.metodo] ?? 0) + x.monto;
  }
  for (const x of gastos) {
    if (x.anulado) continue;
    egresos += x.monto;
    const k = x.categoria || "Sin categoría";
    porCategoria[k] = (porCategoria[k] ?? 0) + x.monto;
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const mesesSet = new Set([hoy.slice(0, 7), mes]);
  fechas.forEach((f) => f && mesesSet.add(f.slice(0, 7)));
  const meses = [...mesesSet].sort().reverse();

  return {
    hoy,
    mes,
    campus,
    area,
    aportes,
    gastos,
    ingresos,
    egresos,
    anterior,
    saldo: anterior + ingresos - egresos,
    porMetodo,
    porCategoria,
    meses,
  };
}

/** totalHistorico_: todo lo aportado en la vida del fondo (área='Campus'
 * suma también todos los aportes de encuentros). */
export async function totalHistorico(db: DB, campus: Campus, area: Area | "Campus") {
  const { data, error } = await db
    .from("fondos_equipo")
    .select("monto")
    .eq("campus", campus)
    .eq("area", area)
    .eq("tipo", "aporte")
    .neq("estado", "Anulado");
  if (error) throw error;
  let total = (data ?? []).reduce((s, x) => s + (Number(x.monto) || 0), 0);
  let cuenta = (data ?? []).length;

  if (area === "Campus") {
    const { data: ap, error: e2 } = await db.from("aportes").select("monto").eq("campus", campus);
    if (e2) throw e2;
    for (const r of ap ?? []) {
      total += Number(r.monto) || 0;
      cuenta++;
    }
  }
  return { total, cuenta };
}

/** ingresosMes_: ingresos de un fondo/mes (área='Campus' suma también los
 * aportes de encuentros, vía ingresosCampus). */
export async function ingresosMes(db: DB, campus: Campus, mes: string, area: Area | "Campus") {
  const r = await fondoResumen(db, campus, mes, area);
  if (area === "Campus") return (await ingresosCampus(db, campus, mes)).total + r.ingresos;
  return r.ingresos;
}

/** tendenciaFondo_: últimos n meses (incluye el actual), para el gráfico. */
export async function tendenciaFondo(db: DB, campus: Campus, area: Area | "Campus", n: number) {
  let cursor = new Date().toISOString().slice(0, 7);
  const meses = [cursor];
  for (let i = 1; i < n; i++) {
    cursor = mesAnt(cursor);
    meses.unshift(cursor);
  }
  return Promise.all(meses.map(async (mes) => ({ mes, monto: await ingresosMes(db, campus, mes, area) })));
}

/** proximoEncuentro_: el encuentro de hoy si corresponde, o el que sigue
 * dentro de las próximas 2 semanas, para las tarjetas de resumen. */
export function proximoEncuentro(campus: Campus, hoyStr = hoy()) {
  const tipos = ENCUENTROS[campus] ?? [];
  const [y0, m0, d0] = hoyStr.split("-").map(Number);
  for (let off = 0; off < 14; off++) {
    const dt = new Date(Date.UTC(y0, m0 - 1, d0 + off, 12));
    const f = dt.toISOString().slice(0, 10);
    const dow = dt.getUTCDay();
    const hit = tipos.find((t) => DIA[t] === dow);
    if (hit) return { encuentro: hit, fecha: f, hoy: off === 0 };
  }
  return null;
}

/** Estado de cierre simplificado: solo si el mes está cerrado y por quién —
 * no replica permisoFondo_ (ventana de 24h de una autorización aprobada);
 * esa parte queda cubierta por /api/fondos/autorizaciones. */
export async function cierreSimplificado(db: DB, campus: Campus, area: Area | "Campus", mes: string) {
  const { data, error } = await db
    .from("cierres_mes")
    .select("por, cuando, automatico")
    .eq("campus", campus)
    .eq("area", area)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  return { cerrado: !!data, por: data?.por ?? "", cuando: data?.cuando ?? "", auto: !!data?.automatico };
}
