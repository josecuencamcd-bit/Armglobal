import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/** Equivalente a api_perfiles: lista de todos los perfiles para administración
 * (gestión de roles/áreas). RLS (perfiles_select_gestion) deja entrar a
 * Finanzas o Admin app.
 *
 * De paso aplica los cambios de rol programados que ya llegaron a su fecha
 * (rpc aplicar_roles_programados, ver migración bitacora_admin / columnas
 * roles_nuevos·areas_nuevas·rol_cambia_desde en perfiles) — así funciona
 * aunque el cron de Vercel no esté corriendo, cada vez que alguien abre
 * Perfiles. */
export async function GET() {
  const admin = createAdminClient();
  await admin.rpc("aplicar_roles_programados");

  const supabase = await createClient();
  const { data, error } = await supabase.from("perfiles").select("*").order("nombre");
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
