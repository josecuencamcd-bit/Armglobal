import { createAdminClient } from "@/lib/supabase/admin";
import { fail, fromSupabaseError, ok } from "@/lib/api-helpers";
import { AREAS_DISPONIBILIDAD, CAMPUS_DISPONIBILIDAD } from "@/lib/disponibilidad";

/**
 * GET público (sin sesión): nombres del equipo elegido, para que la persona
 * escoja el suyo de una lista real en vez de escribirlo a mano (así no
 * entran nombres mal escritos o inventados a `disponibilidad`).
 *
 * Incluye tanto a quienes tienen ese equipo como principal (integrantes.area)
 * como a quienes lo tienen como equipo adicional (integrante_equipos_extra —
 * alguien que sirve en más de un equipo, ver Camino 2 del pedido de José
 * Miguel), para que le aparezca su nombre sin importar en cuál de sus
 * equipos entre a responder.
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
  const campusTyped = campus as (typeof CAMPUS_DISPONIBILIDAD)[number];
  const areaTyped = area as (typeof AREAS_DISPONIBILIDAD)[number];

  const admin = createAdminClient();
  const [principales, extra] = await Promise.all([
    admin.from("integrantes").select("id, nombre").eq("campus", campusTyped).eq("area", areaTyped).neq("estado", "Baja"),
    admin.from("integrante_equipos_extra").select("integrante_id").eq("campus", campusTyped).eq("area", areaTyped),
  ]);
  if (principales.error) return fromSupabaseError(principales.error);
  if (extra.error) return fromSupabaseError(extra.error);

  const idsExtra = (extra.data ?? []).map((e) => e.integrante_id);
  let deExtra: { id: number; nombre: string }[] = [];
  if (idsExtra.length > 0) {
    const { data, error } = await admin
      .from("integrantes")
      .select("id, nombre")
      .in("id", idsExtra)
      .neq("estado", "Baja");
    if (error) return fromSupabaseError(error);
    deExtra = data ?? [];
  }

  const vistos = new Set<number>();
  const combinado = [...(principales.data ?? []), ...deExtra].filter((p) => {
    if (vistos.has(p.id)) return false;
    vistos.add(p.id);
    return true;
  });
  combinado.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return ok(combinado);
}
