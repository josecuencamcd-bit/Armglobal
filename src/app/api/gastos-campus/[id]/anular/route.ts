import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** api_finAnular */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const { data, error, count } = await supabase
    .from("gastos_campus")
    .update(
      { estado: "Anulado", anulado_por: perfil?.correo ?? null, anulado_en: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el gasto no existe.", 403);
  return ok(data);
}
