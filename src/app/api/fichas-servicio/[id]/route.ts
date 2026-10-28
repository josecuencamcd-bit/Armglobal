import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/** api_fichaActualizar */
const PatchSchema = z
  .object({
    nombre: z.string().trim().max(120).optional(),
    encargado: z.string().trim().max(120).optional(),
    puesto: z.string().trim().max(60).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar." });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, PatchSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("fichas_servicio")
    .update({ ...parsedBody.data, actualizado: new Date().toISOString() }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la ficha no existe.", 403);
  return ok(data);
}
