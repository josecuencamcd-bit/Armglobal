import { createAdminClient } from "@/lib/supabase/admin";
import { fail, fromSupabaseError, ok } from "@/lib/api-helpers";
import { AREAS_DISPONIBILIDAD, CAMPUS_DISPONIBILIDAD } from "@/lib/disponibilidad";

/**
 * GET público (sin sesión): nombres del equipo elegido, para que la persona
 * escoja el suyo de una lista real en vez de escribirlo a mano (así no
 * entran nombres mal escritos o inventados a `disponibilidad`).
 *
 * Usa el cliente admin porque quien completa esto todavía no tiene cuenta —
 * mismo caso que /api/solicitudes-acceso. Solo expone id + nombre, nunca
 * teléfono/correo/profesión.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get("campus");
  const area = searchParams.get("area");

  if (!campus || !CAMPUS_DISPONIBILIDAD.includes(campus as (typeof CAMPUS_DISPONIBILIDAD)[number])) {
    return fail("Campus no válido.");
  }
  if (!area || !AREAS_DISPONIBILIDAD.includes(area as (typeof AREAS_DISPONIBILIDAD)[number])) {
    return fail("Equipo no válido.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrantes")
    .select("id, nombre")
    .eq("campus", campus as (typeof CAMPUS_DISPONIBILIDAD)[number])
    .eq("area", area as (typeof AREAS_DISPONIBILIDAD)[number])
    .neq("estado", "Baja")
    .order("nombre");
  if (error) return fromSupabaseError(error);

  return ok(data ?? []);
}
