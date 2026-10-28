import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoVisitaAsignar: asigna la visita a alguien (Pastor de campus, o un
 * líder de Conexión — ver RLS visitas_update). */
const AsignarSchema = z.object({
  asignado_correo: z.string().email(),
  asignado_nombre: z.string().trim().max(120).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, AsignarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error, count } = await supabase
    .from("visitas")
    .update(
      { ...parsedBody.data, actualizado_por: identidad?.perfil.correo ?? null, actualizado_en: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la visita no existe.", 403);
  return ok(data);
}
