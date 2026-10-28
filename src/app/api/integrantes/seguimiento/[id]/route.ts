import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoMarcar: marca el resultado de una visita/llamada de seguimiento programada. */
const MarcarSchema = z.object({
  estado: z.enum(["Vino", "No vino", "Avisó"]),
  respuesta: z.string().trim().max(300).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, MarcarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error, count } = await supabase
    .from("integrante_seguimiento")
    .update({ ...parsedBody.data, marcado_por: identidad?.perfil.correo ?? null }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el registro no existe.", 403);
  return ok(data);
}
