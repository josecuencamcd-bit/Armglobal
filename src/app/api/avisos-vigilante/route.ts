import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/** api_ecoAvisos: lectura de contadores de aviso (RLS: solo Admin app — esta
 * tabla es de uso interno de los vigilantes/cron, no de usuarios comunes). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");

  const supabase = await createClient();
  let query = supabase.from("avisos_vigilante").select("*");
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
