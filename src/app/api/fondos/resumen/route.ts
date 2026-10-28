import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { campusFin, mesOk, mesAnt, pctCambio, ingresosMes, totalHistorico, tendenciaFondo } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";

/** api_ecoResumen: tarjeta de Inicio para Pastor/Ministro/Admin app/Finanzas
 * — histórico del campus, mes actual y variación vs el mes anterior. Si hay
 * una "vista como X" activa, el gate y el campus son los de X. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const modulosOn = (perfil.modulos_on as string[] | null) ?? [];
  const esPastor = roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor");
  const puede = esPastor || roles.includes("Admin app") || modulosOn.includes("finanzas") || modulosOn.includes("informe");
  if (!puede) return fail("Tu perfil no tiene acceso a este resumen.", 403);

  const { searchParams } = new URL(req.url);
  const campus = campusFin(perfil.campus ?? null, searchParams.get("campus"));
  const mes = mesOk(null);
  const mesA = mesAnt(mes);

  try {
    const [actual, anterior, h, tendencia] = await Promise.all([
      ingresosMes(supabase, campus, mes, "Campus"),
      ingresosMes(supabase, campus, mesA, "Campus"),
      totalHistorico(supabase, campus, "Campus"),
      tendenciaFondo(supabase, campus, "Campus", 6),
    ]);
    return ok({ campus, historico: h.total, cuenta: h.cuenta, mesActual: actual, pct: pctCambio(actual, anterior), tendencia });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
