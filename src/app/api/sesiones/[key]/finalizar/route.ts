import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { ArgsSchema } from "@/lib/sesiones";
import { leerSesion, asegurarSesion } from "@/lib/sesiones-db";

/** api_finalizar: marca el encuentro como finalizado. Después de esto, RLS
 * ya no deja editarlo salvo con una autorización vigente (ver
 * auth_autorizado() y /api/sesiones/[key]/autorizacion). */
export async function POST(_req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const [campus, encuentro, evento, fecha] = decodeURIComponent(params.key).split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  if (!parsed.success) return fail("Encuentro no válido.");
  const args = parsed.data;

  const supabase = await createClient();
  try {
    const key = await asegurarSesion(supabase, args);
    const { error } = await supabase
      .from("sesiones")
      .update({ finalizado: true, actualizado: new Date().toISOString() })
      .eq("key", key);
    if (error) throw error;
    return ok(await leerSesion(supabase, args));
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
