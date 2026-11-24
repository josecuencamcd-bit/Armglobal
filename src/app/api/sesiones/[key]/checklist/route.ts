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
 * este encuentro, arranca desde la plantilla guardada del campus (los
 * títulos/detalles/personas a cargo del último encuentro donde se
 * guardaron cambios) y, si tampoco hay una, desde la lista fija de
 * partida — nunca se escribe nada en la base hasta el primer cambio. */
export async function GET(_req: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  const key = decodeURIComponent(params.key);
  const args = argsDeKey(key);
  if (!args) return fail("Encuentro no válido.");

  const supabase = await createClient();
  const [{ data, error }, { data: plantilla }] = await Promise.all([
    supabase.from("sesiones").select("checklist_items, checklist_observacion").eq("key", key).maybeSingle(),
    supabase.from("checklist_plantillas").select("items").eq("campus", args.campus).maybeSingle(),
  ]);
  if (error) return fromSupabaseError(error);

  const items = (data?.checklist_items as ChecklistItem[] | null) ?? [];
  const items_plantilla = (plantilla?.items as ChecklistItem[] | null) ?? [];
  return ok({
    items: items.length > 0 ? items : items_plantilla.length > 0 ? items_plantilla : plantillaChecklist(),
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

    // Esta misma lista (títulos/detalles/personas a cargo, ítems agregados
    // o sacados) queda como plantilla del campus para el próximo encuentro
    // — "hecho" siempre en false, la observación general no se guarda acá
    // porque es una nota semanal, no parte de la plantilla.
    const itemsPlantilla: ChecklistItem[] = parsedBody.data.items.map((it) => ({ ...it, hecho: false }));
    const { error: errorPlantilla } = await supabase
      .from("checklist_plantillas")
      .upsert({ campus: args.campus, items: itemsPlantilla, actualizado: new Date().toISOString() });
    if (errorPlantilla) throw errorPlantilla;

    return ok({ key });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
