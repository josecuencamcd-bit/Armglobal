import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** api_cumpleAprobar: Admin app aprueba el mensaje y queda listo para que el
 * cron lo envíe por WhatsApp (ver tarea pendiente del webhook/cron). */
export async function PATCH(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("cumple_propuestas")
    .update({ estado: "Aprobada", resuelta_en: new Date().toISOString() }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("Solo Admin app puede aprobar, o la propuesta no existe.", 403);
  return ok(data);
}
