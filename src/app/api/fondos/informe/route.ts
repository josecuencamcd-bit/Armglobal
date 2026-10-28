import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { AREAS } from "@/lib/sesiones";
import { campusFin, mesOk, mesAnt, pctCambio, fondoResumen, totalHistorico, tendenciaFondo, cierreSimplificado } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";

/**
 * api_fonInforme: informe mensual del fondo de un equipo (Voluntariado,
 * Técnica, Worship...). Gate: verFondo_ (líder del equipo, o Pastor). Si
 * hay una "vista como X" activa, todo este gate juzga con el perfil de X.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const areasPerfil = (perfil.areas as string[] | null) ?? [];
  const esPastor = roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor");
  const liderFondos = roles.includes("Líder") ? areasPerfil.filter((a) => AREAS.includes(a as (typeof AREAS)[number])) : [];
  if (!esPastor && !liderFondos.length) return fail("Tu perfil no tiene acceso a los fondos de equipo.", 403);

  const areasVisibles = esPastor ? [...AREAS] : liderFondos;
  const { searchParams } = new URL(req.url);
  const areaParam = searchParams.get("area");
  const area = (areasVisibles.includes(areaParam as (typeof AREAS)[number]) ? areaParam : areasVisibles[0]) as (typeof AREAS)[number];
  if (!area) return fail("Tu perfil no lidera ningún equipo con fondo.", 403);

  const campus = campusFin(perfil.campus ?? null, searchParams.get("campus"));
  const mes = mesOk(searchParams.get("mes"));
  const mesA = mesAnt(mes);

  try {
    const [r, prev, historico, tendencia, cierre] = await Promise.all([
      fondoResumen(supabase, campus, mes, area),
      fondoResumen(supabase, campus, mesA, area),
      totalHistorico(supabase, campus, area),
      tendenciaFondo(supabase, campus, area, 6),
      cierreSimplificado(supabase, campus, area, mes),
    ]);

    return ok({
      ...r,
      areas: areasVisibles,
      puedeEditar: liderFondos.includes(area),
      cierre,
      comparacion: { actual: r.ingresos, anterior: prev.ingresos, pct: pctCambio(r.ingresos, prev.ingresos) },
      historico: historico.total,
      cuentaHistorico: historico.cuenta,
      tendencia,
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
