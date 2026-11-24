import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { ArgsSchema } from "@/lib/sesiones";
import { asegurarSesion } from "@/lib/sesiones-db";
import { ChecklistSchema, plantillaChecklist, type ChecklistItem } from "@/lib/checklist";

function argsDeKey(key: string) {
  const [campus, encuentro, evento, fecha] = key.split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  return parsed.success ? parsed.data : null;
}

/** GET: checklist pre-encuentro. Si todavía no se ha guardado nada para
 * este encuentro, se devuelve la plantilla fija de partida (sin escribirla
 * en la base — recién se guarda cuando el administrador hace el primer
 * cambio). */
export async function GET(_req: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  const key = decodeURIComponent(params.key);
  if (!argsDeKey(key)) return fail("Encuentro no válido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sesiones")
    .select("checklist_items, checklist_observacion")
    .eq("key", key)
    .maybeSingle();
  if (error) return fromSupabaseError(error);

  const items = (data?.checklist_items as ChecklistItem[] | null) ?? [];
  return ok({
    items: items.length > 0 ? items : plantillaChecklist(),
    observacion: data?.checklist_observacion ?? "",
  });
}

/** PATCH: guarda la lista completa de ítems (marcados/no marcados, personas
 * a cargo, ítems agregados o sacados) + la observación general. */
export async function PATCH(req: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  const key = decodeURIComponent(params.key);
  const args = argsDeKey(key);
  if (!args) return fail("Encuentro no válido.");

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return fail("Body JSON inválido.");
  }
  const parsedBody = ChecklistSchema.safeParse(bodyJson);
  if (!parsedBody.success) {
    const primero = parsedBody.error.issues[0];
    return fail(`${primero.path.join(".")}: ${primero.message}`);
  }

  const supabase = await createClient();
  try {
    await asegurarSesion(supabase, args);
    const { error } = await supabase
      .from("sesiones")
      .update({
        checklist_items: parsedBody.data.items,
        checklist_observacion: parsedBody.data.observacion,
        actualizado: new Date().toISOString(),
      })
      .eq("key", key);
    if (error) throw error;
    return ok({ key });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
