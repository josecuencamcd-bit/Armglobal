import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { z } from "zod";

/** Datos de transferencia del campus (cuenta/banco/rut) que el líder de
 * Merch carga una vez — la vitrina pública (/vitrina) los muestra cuando
 * alguien elige pagar por Transferencia. RLS (merch_config_select/write)
 * los limita a área Merch o Finanzas del mismo campus. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  if (!campus) return fail("Falta el campus.", 400);

  const supabase = await createClient();
  const { data, error } = await supabase.from("merch_config").select("*").eq("campus", campus).maybeSingle();
  if (error) return fromSupabaseError(error);
  return ok(data ?? { campus, datos_transferencia: null });
}

const ConfigSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  datos_transferencia: z.string().trim().max(500).nullable(),
});

export async function PATCH(req: Request) {
  const parsedBody = await parseBody(req, ConfigSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merch_config")
    .upsert({ ...parsedBody.data, actualizado_en: new Date().toISOString() }, { onConflict: "campus" })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data);
}
