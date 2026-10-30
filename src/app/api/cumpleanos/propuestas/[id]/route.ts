import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/** api_cumplePropGuardar: Admin app edita el texto de una propuesta (antes
 * de que se envíe). Solo se puede editar si sigue Pendiente o Aprobada; al
 * guardar vuelve a Pendiente (hay que volver a aprobarla), igual que en la
 * app vieja. */
const GuardarSchema = z.object({
  saludo: z.string().trim().min(1).max(700).optional(),
  mensaje: z.string().trim().min(1).max(700).optional(),
  abrazo: z.string().trim().min(1).max(700).optional(),
  versiculo: z.string().trim().min(1).max(700).optional(),
  gracias: z.string().trim().max(700).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const parsedBody = await parseBody(req, GuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const params = await context.params;
  const supabase = await createClient();

  const { data: actual, error: e1 } = await supabase
    .from("cumple_propuestas")
    .select("estado")
    .eq("id", Number(params.id))
    .maybeSingle();
  if (e1) return fromSupabaseError(e1);
  if (!actual) return fail("La propuesta no existe.", 404);
  if (actual.estado !== "Pendiente" && actual.estado !== "Aprobada") {
    return fail("Esta propuesta ya no se puede editar.", 409);
  }

  const { data, error, count } = await supabase
    .from("cumple_propuestas")
    .update({ ...parsedBody.data, estado: "Pendiente" }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("Solo Admin app puede editar, o la propuesta no existe.", 403);
  return ok(data);
}
