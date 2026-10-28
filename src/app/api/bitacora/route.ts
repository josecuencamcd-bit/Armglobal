import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/**
 * Bitácora de administración (ver src/lib/bitacora.ts): reemplaza el
 * "entrar al perfil de otro y ver en vivo lo que hacía" de la app vieja
 * por un registro que Admin app puede repasar cuando lo necesite — mismo
 * propósito de soporte/auditoría, sin tener que mirar la sesión de nadie
 * en tiempo real. RLS (bitacora_select_admin_app) solo deja leer a
 * Admin app.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bitacora")
    .select("*")
    .order("en", { ascending: false })
    .limit(100);
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
