import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";

/** api_finAnular. Si hay una "vista como X" activa, queda anulado a
 * nombre de X (ver identidadActuante). */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error, count } = await supabase
    .from("gastos_campus")
    .update(
      { estado: "Anulado", anulado_por: identidad?.perfil.correo ?? null, anulado_en: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el gasto no existe.", 403);
  return ok(data);
}
