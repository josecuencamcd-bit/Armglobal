import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { AREAS } from "@/lib/sesiones";
import { campusFin, mesOk, fondoResumen, tendenciaFondo, proximoEncuentro } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";

/** api_ecoResumenLider: tarjeta de Inicio de un Líder de equipo — saldo de
 * su fondo y próximo encuentro del campus. Si hay una "vista como X"
 * activa, el gate y el campus son los de X. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const areasPerfil = (perfil.areas as string[] | null) ?? [];
  const areas = roles.includes("Líder") ? areasPerfil.filter((a) => AREAS.includes(a as (typeof AREAS)[number])) : [];
  if (!areas.length) return fail("Tu perfil no lidera un fondo de equipo.", 403);

  const { searchParams } = new URL(req.url);
  const campus = campusFin(perfil.campus ?? null, searchParams.get("campus"));
  const area = areas[0] as (typeof AREAS)[number];
  const mes = mesOk(null);

  try {
    const [r, tendencia] = await Promise.all([fondoResumen(supabase, campus, mes, area), tendenciaFondo(supabase, campus, area, 6)]);
    const movimientos = [...r.aportes, ...r.gastos].filter((x) => !x.anulado).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const ultimoMov = movimientos[0];
    const ultimo = ultimoMov
      ? { tipo: r.aportes.includes(ultimoMov) ? "aporte" : "gasto", monto: ultimoMov.monto, fecha: ultimoMov.fecha }
      : null;

    return ok({
      area,
      campus,
      saldo: r.saldo,
      ingresos: r.ingresos,
      egresos: r.egresos,
      ultimo,
      proximo: proximoEncuentro(campus),
      tendencia,
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
