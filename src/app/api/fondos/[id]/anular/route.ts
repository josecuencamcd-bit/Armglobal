import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** "Anular" un movimiento: Code.gs nunca borra filas de fondos (hay que
 * poder auditarlas), solo las marca. RLS (fondos_equipo_update) exige la
 * misma área (o Finanzas) que para registrar. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: perfil } = user
      ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
      : { data: null };

    const { data, error, count } = await supabase
      .from("fondos_equipo")
      .update(
        { estado: "Anulado", anulado_por: perfil?.correo ?? null, anulado_en: new Date().toISOString() },
        { count: "exact" }
      )
      .eq("id", Number(params.id))
      .select()
      .maybeSingle();
    if (error) throw error;
    if (count === 0) return fail("No tienes permiso, o el registro no existe.", 403);
    return ok(data);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
