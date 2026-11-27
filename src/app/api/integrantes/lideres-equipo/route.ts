import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";

/**
 * Nombres de quienes lideran un área en un campus — para destacar al
 * líder dentro de "Mi equipo" (vista de solo lectura). perfiles_select_
 * directorio_campus ya deja ver a cualquier persona del mismo campus
 * (sin datos sensibles acá, solo nombre), así que esto corre con el
 * cliente normal (RLS), no con el admin.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));
  if (!campus || !area) return fail("Campus o equipo no válido.", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("campus", campus)
    .contains("roles", ["Líder"])
    .contains("areas", [area]);
  if (error) return fromSupabaseError(error);
  return ok((data ?? []).map((p) => p.nombre));
}
