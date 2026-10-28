import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/** Equivalente a api_perfiles: lista de todos los perfiles para administración
 * (gestión de roles/áreas). RLS (perfiles_select_gestion) deja entrar a
 * Finanzas o Admin app. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("perfiles").select("*").order("nombre");
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
