import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { firmarFoto } from "@/lib/fotos";

/**
 * api_fonFoto: devuelve la foto de un aporte/gasto de fondo de equipo. El
 * permiso (verFondo_ + áreas visibles, o Pastor para area='Campus') ya lo
 * aplica la policy SELECT de `fondos_equipo` — si la fila no es visible
 * para este usuario, acá no aparece, igual que en Code.gs.
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("fondos_equipo")
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
