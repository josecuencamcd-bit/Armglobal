import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, fromSupabaseError, ok } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { CAMPUS, AREAS } from "@/lib/sesiones";

/**
 * GET autenticado: solo id + nombre de un equipo — para el selector "Otro
 * equipo" al asignar un puesto en la ficha, donde un líder necesita ver
 * quién hay en OTRO equipo (no el suyo) para prestarlo puntualmente.
 *
 * integrantes_select (RLS) solo deja ver el área propia (auth_areas()) o
 * en la que uno mismo sirve (auth_sirve()) — por diseño, para que un líder
 * no vea los datos completos (teléfono, correo, etc.) de otro equipo. Esta
 * ruta expone la misma info mínima que ya expone /api/disponibilidad/roster
 * (pública), pero solo a quien tiene sesión — por eso usa el cliente admin
 * con un chequeo de sesión propio en vez de RLS.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get("campus");
  const area = searchParams.get("area");

  if (!campus || !CAMPUS.includes(campus as (typeof CAMPUS)[number])) return fail("Campus no válido.");
  if (!area || !AREAS.includes(area as (typeof AREAS)[number])) return fail("Equipo no válido.");
  const campusTyped = campus as (typeof CAMPUS)[number];
  const areaTyped = area as (typeof AREAS)[number];

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrantes")
    .select("id, nombre")
    .eq("campus", campusTyped)
    .eq("area", areaTyped)
    .neq("estado", "Baja")
    .order("nombre", { ascending: true });
  if (error) return fromSupabaseError(error);

  return ok(data ?? []);
}
