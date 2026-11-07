import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { firmarFoto } from "@/lib/fotos";

/** Mismo patrón que /api/gastos-campus/[id]/foto — la policy SELECT de
 * `merch_solicitudes` decide visibilidad (solicitante, líder de Merch o
 * Finanzas). */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("merch_solicitudes")
      .select("comprobante_url")
      .eq("id", Number(params.id))
      .maybeSingle();
    if (error) throw error;
    if (!data?.comprobante_url) return fail("Comprobante no encontrado.", 404);
    return ok({ url: await firmarFoto(data.comprobante_url) });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
