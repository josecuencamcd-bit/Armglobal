import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, fromSupabaseError, ok } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { CAMPUS, AREAS } from "@/lib/sesiones";

/**
 * GET autenticado: busca por nombre a través de TODOS los equipos del
 * campus (no solo el propio) — para que, al agregar un integrante, el
 * líder pueda encontrar a alguien que ya está en otro equipo y vincularlo
 * en vez de crear un duplicado (ver /api/integrantes/[id]/equipo-extra).
 *
 * Igual que roster-equipo: cruza áreas a propósito, así que usa el
 * cliente admin con chequeo de sesión propio en vez de RLS (que por
 * diseño limita a cada líder a su propia área). Solo expone id, nombre y
 * área — nunca teléfono/correo/cumpleaños de gente de otro equipo.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get("campus");
  const q = (searchParams.get("q") ?? "").trim();
  const excluirArea = searchParams.get("excluirArea");

  if (!campus || !CAMPUS.includes(campus as (typeof CAMPUS)[number])) return fail("Campus no válido.");
  if (q.length < 2) return ok([]);
  if (excluirArea && !AREAS.includes(excluirArea as (typeof AREAS)[number])) return fail("Equipo no válido.");
  const campusTyped = campus as (typeof CAMPUS)[number];
  const excluirAreaTyped = excluirArea as (typeof AREAS)[number] | null;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const admin = createAdminClient();
  let query = admin
    .from("integrantes")
    .select("id, nombre, area")
    .eq("campus", campusTyped)
    .neq("estado", "Baja")
    .ilike("nombre", `%${q}%`)
    .order("nombre", { ascending: true })
    .limit(8);
  if (excluirAreaTyped) query = query.neq("area", excluirAreaTyped);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);

  let resultados = data ?? [];
  if (excluirAreaTyped && resultados.length > 0) {
    // No mostrar a quien ya está vinculado a ese equipo como adicional
    // (ya aparecería en el equipo, no tiene sentido ofrecerlo de nuevo).
    const { data: yaExtra } = await admin
      .from("integrante_equipos_extra")
      .select("integrante_id")
      .eq("area", excluirAreaTyped)
      .in("integrante_id", resultados.map((r) => r.id));
    const idsExtra = new Set((yaExtra ?? []).map((e) => e.integrante_id));
    resultados = resultados.filter((r) => !idsExtra.has(r.id));
  }

  return ok(resultados);
}
