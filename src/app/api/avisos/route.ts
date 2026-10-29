import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { cierreSimplificado } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";

const FONDO_AREAS = ["Kids", "Tweens", "Técnica", "Worship", "Conexión", "Voluntariado"] as const;

function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
}

/** mesAnt_: mes calendario anterior a `mes` (yyyy-mm). */
function mesAnt(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1, 12)).toISOString().slice(0, 7);
}
function ultimoDiaMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}
/** mesPorCerrar_: el mes "en ventana de cierre" ahora mismo (últimos 2 días
 * del mes o primeros 4 del siguiente), o '' si ninguno aplica. */
function mesPorCerrar(hoy: string): string {
  const dia = Number(hoy.slice(8));
  const act = hoy.slice(0, 7);
  if (dia <= 4) return mesAnt(act);
  if (ultimoDiaMes(act) - dia <= 2) return act;
  return "";
}

/**
 * api_ecoAvisos: recordatorios en Inicio — encuentros de días pasados que
 * nadie finalizó, e hilos de notas de área pendientes de cerrar. Si hay una
 * "vista como X" activa, se calcula para X (identidadActuante). No incluye
 * el aviso de cierre de mes de fondos: eso ya lo muestra cada pantalla
 * (Fondos/Finanzas) con su propia tarjeta "Cerrar mes".
 */
export async function GET() {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const areasPerfil = (perfil.areas as string[] | null) ?? [];
  const esAdmin = roles.includes("Admin app");
  const esPastorCampus = roles.includes("Pastor de campus") || roles.includes("Pastor principal") || roles.includes("Pastor");
  const esAdministrador = roles.includes("Administrador");
  const esLider = roles.includes("Líder");
  const esPastor = roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor");
  const liderFondos = esLider ? areasPerfil.filter((a) => (FONDO_AREAS as readonly string[]).includes(a)) : [];

  const hoy = hoyISO();
  const campusVisibles: readonly string[] =
    esAdmin || perfil.campus == null ? CAMPUS : [perfil.campus];

  try {
    const encuentros: { campus: string; encuentro: string; fecha: string; key: string }[] = [];
    if (esAdmin || esPastorCampus || esAdministrador) {
      const { data, error } = await supabase
        .from("sesiones")
        .select("key, campus, encuentro, fecha")
        .eq("finalizado", false)
        .lt("fecha", hoy)
        .in("campus", campusVisibles as unknown as ("Punta Arenas" | "Puerto Natales")[])
        .order("fecha", { ascending: true })
        .limit(10);
      if (error) throw error;
      (data ?? []).forEach((s) => encuentros.push(s));
    }

    const notas: { campus: string; area: string; fecha: string; key: string }[] = [];
    if (esLider && areasPerfil.length) {
      const { data, error } = await supabase
        .from("notas")
        .select("key, campus, area, fecha")
        .eq("finalizado", false)
        .lt("fecha", hoy)
        .in("campus", campusVisibles as unknown as ("Punta Arenas" | "Puerto Natales")[])
        .in("area", areasPerfil as unknown as ("Kids" | "Tweens" | "Técnica" | "Worship" | "Conexión" | "Voluntariado" | "Stand de Oración" | "Campus")[])
        .order("fecha", { ascending: true })
        .limit(10);
      if (error) throw error;
      (data ?? []).forEach((n) => notas.push(n));
    }

    // mesPorCerrar_ + fondosCierre_: qué fondos "míos" siguen sin cierre en
    // el mes que está en ventana (últimos 2 días del mes / primeros 4 del
    // siguiente) — mismo aviso de api_ecoAvisos en Code.gs.
    const cierres: { campus: string; area: string; mes: string }[] = [];
    const mes = mesPorCerrar(hoy);
    if (mes) {
      for (const c of campusVisibles) {
        for (const ar of [...FONDO_AREAS, "Campus"] as const) {
          const mio = ar === "Campus" ? esPastor : liderFondos.includes(ar) || esPastorCampus;
          if (!mio) continue;
          const cierre = await cierreSimplificado(supabase, c as "Punta Arenas" | "Puerto Natales", ar, mes);
          if (!cierre.cerrado) cierres.push({ campus: c, area: ar, mes });
        }
      }
    }

    // api_fonAutLista: autorizaciones de reapertura de fondos que esperan
    // la acción de ESTA persona (Pastor de campus da el "Ok" primero,
    // Admin app aprueba después).
    let autorizaciones = 0;
    if (esPastorCampus || esAdmin) {
      const { data: aut, error: eAut } = await supabase.from("autorizaciones_fondos").select("campus, estado");
      if (eAut) throw eAut;
      autorizaciones = (aut ?? []).filter((x) => {
        if (esAdmin) return x.estado === "Pendiente Admin";
        return x.estado === "Pendiente Pastor" && (perfil.campus == null || x.campus === perfil.campus);
      }).length;
    }

    return ok({
      encuentros,
      notas,
      cierres,
      autorizaciones,
      total: encuentros.length + notas.length + cierres.length + (autorizaciones > 0 ? 1 : 0),
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
