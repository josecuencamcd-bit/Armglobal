import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";

/** Stock actual de Merch por campus (tipo × talla) — RLS de merch_articulos
 * ya limita a área "Merch" o Finanzas, así que quien llama sin permiso
 * simplemente recibe lista vacía, no un 403. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));

  const supabase = await createClient();
  let query = supabase.from("merch_articulos").select("*").order("tipo").order("talla");
  if (campus) query = query.eq("campus", campus);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
