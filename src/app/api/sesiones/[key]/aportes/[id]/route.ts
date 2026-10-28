import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** DELETE: equivalente a api_delAporte. La policy aportes_delete exige
 * esFinanzas_() + que el encuentro no esté finalizado (o autorización
 * vigente) — igual gating que sobre `sesiones`. Si RLS rechaza, count=0. */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ key: string; id: string }> }
) {
  const params = await context.params;
  const key = decodeURIComponent(params.key);
  const supabase = await createClient();
  try {
    const { error, count } = await supabase
      .from("aportes")
      .delete({ count: "exact" })
      .eq("sesion_key", key)
      .eq("id", params.id);
    if (error) throw error;
    if (count === 0) {
      return fail("No se pudo eliminar (no existe, o el encuentro ya está finalizado).", 403);
    }
    return ok({ eliminado: params.id });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
