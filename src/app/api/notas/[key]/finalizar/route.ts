import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** api_ecoFinalizar: cierra un hilo de notas de área (no se puede seguir
 * editando salvo que se reabra a mano, igual que un encuentro finalizado). */
export async function POST(_req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("notas")
    .update({ finalizado: true, actualizado: new Date().toISOString() }, { count: "exact" })
    .eq("key", decodeURIComponent(params.key))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la nota no existe.", 403);
  return ok(data);
}
