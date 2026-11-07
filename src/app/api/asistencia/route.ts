import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { ctxAsistencia, claveNota, campusValido, areaValida, fichaAdministracion, fichaFaltantes } from "@/lib/asistencia";

/**
 * api_ecoAsistencia/asistenciaDe_: la asistencia de un área en un día — a
 * quién se programó, quién vino/no vino/avisó, la nota del encuentro, si ya
 * se finalizó, y (solo Punta Arenas) quién administra según la ficha y
 * qué nombres de la ficha no están registrados en Mi equipo.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get("campus");
  const area = searchParams.get("area");
  const fecha = searchParams.get("fecha");
  if (!campusValido(campus)) return fail("Campus no válido.", 400);
  if (!areaValida(area)) return fail("Área no válida.", 400);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("Fecha no válida.", 400);

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const { lider, puedeVer } = ctxAsistencia(identidad.perfil, campus, area);
  if (!puedeVer) return fail("Tu perfil no tiene acceso a esta sección.", 403);

  try {
    const [{ data: filas, error: eFilas }, { data: integrantes, error: eInt }, { data: nota, error: eNota }] = await Promise.all([
      supabase
        .from("integrante_seguimiento")
        .select("id, integrante_id, nombre, estado, observacion, respuesta")
        .eq("campus", campus)
        .eq("area", area)
        .eq("fecha", fecha)
        .neq("estado", "Quitado")
        .order("nombre", { ascending: true }),
      supabase.from("integrantes").select("id, nombre, rol_servicio").eq("campus", campus).eq("area", area).neq("estado", "Baja").order("nombre"),
      supabase.from("notas").select("nota, finalizado").eq("key", claveNota(campus, area, fecha)).maybeSingle(),
    ]);
    if (eFilas) throw eFilas;
    if (eInt) throw eInt;
    if (eNota) throw eNota;

    const nombresIntegrantes = (integrantes ?? []).map((p) => p.nombre);
    const [administracion, faltantes] = await Promise.all([
      fichaAdministracion(supabase, campus, area, fecha),
      fichaFaltantes(supabase, campus, area, fecha, nombresIntegrantes),
    ]);

    return ok({
      fecha,
      campus,
      area,
      puedeEditar: lider,
      finalizado: !!nota?.finalizado,
      nota: nota?.nota ?? "",
      filas: filas ?? [],
      integrantes: integrantes ?? [],
      administracion,
      faltantes,
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
