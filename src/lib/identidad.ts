import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];

/**
 * "Ver la app como X": equivalente al "entrar al perfil de otro y ver en
 * vivo lo que hacía" de la app vieja. Un Admin app activo una fila en
 * `impersonaciones_activas` (su propia fila, admin_id = su auth.uid()) y
 * desde ahí, hasta que la cierre, actúa CON LA IDENTIDAD de esa persona:
 * lo que registre queda guardado a nombre de ella — igual que el
 * comportamiento real de Code.gs, no un registro aparte.
 *
 * identidadActuante() es el único lugar que resuelve "quién es, a efectos
 * de la app, quien está haciendo esta petición" — las rutas que necesiten
 * atribuir una acción (quién aportó, quién registró un gasto, etc.) deben
 * usar `.perfil` de aquí en vez de volver a consultar `perfiles` por
 * `auth.uid()` directamente.
 */
export async function identidadActuante(
  supabase: SupabaseClient<Database>
): Promise<{ real: Perfil; perfil: Perfil; impersonando: boolean } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: real } = await supabase.from("perfiles").select("*").eq("id", user.id).maybeSingle();
  if (!real) return null;

  const { data: imp } = await supabase
    .from("impersonaciones_activas")
    .select("target_id")
    .eq("admin_id", user.id)
    .maybeSingle();

  if (!imp) return { real, perfil: real, impersonando: false };

  const { data: target } = await supabase.from("perfiles").select("*").eq("id", imp.target_id).maybeSingle();
  // Si el target fue borrado o algo falló, no bloquea: sigue como el admin real.
  if (!target) return { real, perfil: real, impersonando: false };

  return { real, perfil: target, impersonando: true };
}
