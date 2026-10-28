import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { z } from "zod";

const ROLES = [
  "Pastor principal", "Pastor de campus", "Pastor", "Ministro",
  "Administrador", "Líder", "Voluntario", "Admin app",
] as const;

/**
 * Equivalente a api_perfilGuardar: edita roles/áreas/a quién sirve/bloqueo de
 * OTRO usuario. Solo pasa la policy perfiles_update_admin_app (el trigger
 * perfiles_proteger_columnas_sensibles revierte estos campos si quien
 * escribe no es Admin app — incluso si alguien intentara llamar esta ruta
 * sobre su propio id).
 */
const PerfilGuardarSchema = z
  .object({
    roles: z.array(z.enum(ROLES)).optional(),
    areas: z.array(z.enum(AREAS)).optional(),
    sirve: z.array(z.enum(AREAS)).optional(),
    campus: z.enum(CAMPUS).optional(),
    bloqueado: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar." });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, PerfilGuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("perfiles")
    .update({ ...parsedBody.data, actualizado_en: new Date().toISOString() }, { count: "exact" })
    .eq("id", params.id)
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso (Admin app), o el perfil no existe.", 403);
  return ok(data);
}
