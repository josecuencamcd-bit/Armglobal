import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const { data, error, count } = await supabase
    .from("visitas")
    .update(
      { ...parsedBody.data, actualizado_por: perfil?.correo ?? null, actualizado_en: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la visita no existe.", 403);
  return ok(data);
}
