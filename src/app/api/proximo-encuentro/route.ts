import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api-helpers";
import { campusFin, proximoEncuentro } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";

/** Tarjeta "Próximo encuentro" de Inicio — José pidió que sea visible
 * para cualquiera (no solo para el Líder responsable del fondo, que es
 * donde vivía antes, dentro de /api/fondos/resumen-lider). proximoEncuentro()
 * solo depende del campus y la fecha de hoy — no hay nada sensible que
 * filtrar por rol acá. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const { searchParams } = new URL(req.url);
  const campus = campusFin(identidad.perfil.campus ?? null, searchParams.get("campus"));
  return ok(proximoEncuentro(campus));
}
