import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** api_reuCancelar */
export async function PATCH(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("reuniones")
    .update({ estado: "Cancelada" }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la reunión no existe.", 403);
  return ok(data);
}
