import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, fromSupabaseError, ok, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { AREAS } from "@/lib/sesiones";
import { esFin } from "@/lib/visibilidad-modulos";

const BodySchema = z.object({ area: z.enum(AREAS, { error: () => "Equipo no válido." }) });

/**
 * POST autenticado: vincula a un integrante que YA EXISTE (con área
 * principal en otro equipo) como miembro adicional de este equipo — en vez
 * de crear un duplicado cuando el líder lo encuentra con el buscador de
 * "Agregar integrante" (ver /api/integrantes/buscar).
 *
 * Autorización en código (no RLS): la política de integrante_equipos_extra
 * solo deja escribir al líder del área PRINCIPAL de esa persona — acá es al
 * revés, el líder del equipo NUEVO es quien agrega, así que se valida
 * contra identidad.perfil.areas (sus propias áreas) en vez de la del
 * integrante, y se usa el cliente admin para el insert.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const integranteId = Number(params.id);
  if (!Number.isInteger(integranteId) || integranteId <= 0) return fail("Integrante no válido.");

  const parsed = await parseBody(req, BodySchema);
  if ("error" in parsed) return parsed.error;
  const { area } = parsed.data;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const autorizado = esFin(identidad.perfil) || identidad.perfil.areas.includes(area);
  if (!autorizado) return fail("No tienes permiso para agregar gente a ese equipo.", 403);

  const admin = createAdminClient();
  const { data: integrante, error: errInt } = await admin
    .from("integrantes")
    .select("id, nombre, campus, area, estado")
    .eq("id", integranteId)
    .maybeSingle();
  if (errInt) return fromSupabaseError(errInt);
  if (!integrante || integrante.estado === "Baja") return fail("No encontramos a esa persona.");
  if (integrante.area === area) return fail(`${integrante.nombre} ya es parte de ${area} como equipo principal.`);

  const { error } = await admin
    .from("integrante_equipos_extra")
    .upsert(
      { integrante_id: integrante.id, area, campus: integrante.campus },
      { onConflict: "integrante_id,area" }
    );
  if (error) return fromSupabaseError(error);

  return ok({ vinculado: true, nombre: integrante.nombre }, 201);
}
