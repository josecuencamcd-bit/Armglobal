import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Equivalente a api_yo / api_miPerfil / api_miPerfilGuardar. El login/registro
 * propio de Code.gs (api_login, api_registrar, api_olvide, api_restablecer)
 * se reemplaza enteramente por Supabase Auth en el cliente
 * (supabase.auth.signInWithPassword / signUp / resetPasswordForEmail) — no
 * necesitan ruta propia.
 *
 * Nota de seguridad: aunque la policy `perfiles_update_propio` es a nivel de
 * fila, un trigger (`perfiles_proteger_columnas_sensibles`) impide que un
 * usuario cambie sus propios roles/areas/sirve/bloqueado/campus/modulos_*
 * aunque el body incluya esos campos — solo Admin app puede tocarlos
 * (vía /api/perfiles/[id], ver api_perfilGuardar).
 */
const MiPerfilSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    telefono: z.string().trim().max(30).optional(),
    nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    foto_url: z.string().url().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar." });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data, error } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function PATCH(req: Request) {
  const parsedBody = await parseBody(req, MiPerfilSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data, error } = await supabase
    .from("perfiles")
    .update({ ...parsedBody.data, actualizado_en: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data);
}
