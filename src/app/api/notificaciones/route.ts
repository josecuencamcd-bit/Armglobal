import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { notificacionesPendientes } from "@/lib/notificaciones";

/** api_notificaciones: bandeja de pendientes (Reporte/Aportes/Checklist
 * sin cerrar, pasada la hora límite) del campus que esté mirando quien
 * pide la lista. El frontend decide, por ítem, si mostrar el botón para
 * ir directo (esResponsable) o solo el texto informativo. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: perfil, error: eP } = await supabase.from("perfiles").select("nombre, campus").eq("id", user.id).maybeSingle();
  if (eP) return fromSupabaseError(eP);
  if (!perfil) return fail("Perfil no encontrado.", 404);

  const url = new URL(req.url);
  const campusParam = url.searchParams.get("campus");
  const campus = (CAMPUS as readonly string[]).includes(campusParam ?? "")
    ? (campusParam as (typeof CAMPUS)[number])
    : (perfil.campus ?? CAMPUS[0]);

  try {
    const items = await notificacionesPendientes(supabase, campus, perfil.nombre);
    return ok(items);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
