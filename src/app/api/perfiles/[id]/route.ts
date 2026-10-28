import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { registrarBitacora } from "@/lib/bitacora";
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
    campus: z.enum(CAMPUS).nullable().optional(),
    bloqueado: z.boolean().optional(),
    // Cambio de rol/área programado para una fecha futura (equivalente a
    // la "autonomía" de la app vieja donde alguien quedaba con un rol
    // nuevo "a partir de" cierto día): se guarda en roles_nuevos/
    // areas_nuevas/rol_cambia_desde y la función aplicar_roles_programados()
    // (llamada desde el cron y al leer el perfil) lo aplica solo cuando
    // llega la fecha, sin que nadie tenga que volver a tocarlo.
    roles_nuevos: z.array(z.enum(ROLES)).nullable().optional(),
    areas_nuevas: z.array(z.enum(AREAS)).nullable().optional(),
    rol_cambia_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = user
    ? await supabase.from("perfiles").select("correo, nombre").eq("id", user.id).maybeSingle()
    : { data: null };
  await registrarBitacora({
    actorCorreo: actor?.correo,
    actorNombre: actor?.nombre,
    accion: "perfil_editado",
    entidad: "perfiles",
    entidadId: params.id,
    detalle: { cambios: parsedBody.data, correo: data?.correo },
  });

  return ok(data);
}
