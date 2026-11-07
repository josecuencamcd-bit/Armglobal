import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { ArgsSchema } from "@/lib/sesiones";
import { leerSesion, asegurarSesion } from "@/lib/sesiones-db";
import { z } from "zod";

const Schema = z.object({ finalizado: z.boolean().optional().default(true) });

/** api_finalizar: marca (o desmarca, para "reabrir" el mismo día) el
 * encuentro como finalizado. El verdadero candado para editar pasado el
 * día del encuentro es auth_mismo_dia()/auth_autorizado() en RLS — este
 * flag ya no es lo que bloquea la edición por sí solo, solo registra si
 * el encuentro quedó cerrado o no para quien lo revise después. */
export async function POST(req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const [campus, encuentro, evento, fecha] = decodeURIComponent(params.key).split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  if (!parsed.success) return fail("Encuentro no válido.");
  const args = parsed.data;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // sin body: se mantiene el default (finalizar)
  }
  const parsedBody = Schema.safeParse(body);
  if (!parsedBody.success) return fail("Valor no válido.");

  const supabase = await createClient();
  try {
    const key = await asegurarSesion(supabase, args);
    const { error } = await supabase
      .from("sesiones")
      .update({ finalizado: parsedBody.data.finalizado, actualizado: new Date().toISOString() })
      .eq("key", key);
    if (error) throw error;
    return ok(await leerSesion(supabase, args));
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
