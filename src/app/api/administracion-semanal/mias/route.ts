import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";

/** Semanas en las que el usuario actual aparece en el arreglo `correos` de
 * administración semanal de su campus. Si hay una "vista como X" activa,
 * son las semanas de X (para que "Esta semana sirves" refleje al que se
 * está viendo, igual que la app vieja). */
export async function GET() {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const { data, error } = await supabase
    .from("administracion_semanal")
    .select("*")
    .contains("correos", [identidad.perfil.correo])
    .order("semana", { ascending: true });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
