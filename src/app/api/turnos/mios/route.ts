import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

/** api_ecoMisTurnos: semanas en las que el usuario actual aparece en el
 * arreglo `correos` de turnos de su campus. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: perfil, error: ePerfil } = await supabase
    .from("perfiles")
    .select("correo")
    .eq("id", user.id)
    .single();
  if (ePerfil) return fromSupabaseError(ePerfil);

  const { data, error } = await supabase
    .from("turnos")
    .select("*")
    .contains("correos", [perfil.correo])
    .order("semana", { ascending: true });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
