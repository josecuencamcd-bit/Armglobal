import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/** api_reuDirectorio: directorio de correos/nombres para invitar a una
 * reunión (mismo alcance que ve el usuario en `perfiles`). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("correo, nombre, campus, roles")
    .order("nombre");
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
