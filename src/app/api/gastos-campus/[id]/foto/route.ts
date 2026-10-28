import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { firmarFoto } from "@/lib/fotos";

/** api_fonFoto (rama Gastos Campus): mismo patrón que /api/fondos/[id]/foto,
 * la policy SELECT de `gastos_campus` (Finanzas) decide visibilidad. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("gastos_campus")
      .select("foto_url")
      .eq("id", Number(params.id))
      .maybeSingle();
    if (error) throw error;
    if (!data?.foto_url) return fail("Foto no encontrada.", 404);
    return ok({ url: await firmarFoto(data.foto_url) });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
