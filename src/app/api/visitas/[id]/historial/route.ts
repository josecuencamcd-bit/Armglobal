import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/** Historial de cambios de estado de una visita — lo que deja
 * /api/visitas/[id]/estado en visitas_historial, sin pantalla propia hasta
 * ahora. RLS (visitas_historial_rw) exige que la visita referida sea del
 * campus que ya puede ver el usuario. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visitas_historial")
    .select("*")
    .eq("visita_id", Number(params.id))
    .order("creado_en", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
