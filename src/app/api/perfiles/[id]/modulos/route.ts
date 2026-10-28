import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Equivalente a api_modulosGuardar: "El administrador de la app fija qué
 * módulos ve una persona, sin importar su rol base" — Admin-app-ONLY sobre
 * OTRO usuario, no autoservicio (el trigger perfiles_proteger_columnas_sensibles
 * revierte modulos_on/off si quien escribe no es Admin app, igual que
 * roles/areas/sirve). Es solo preferencia de interfaz (qué botones ve), no
 * autorización real — la autorización la deciden roles/áreas vía RLS.
 */
const MODULOS_APP = [
  "panorama", "stats", "equipo", "asistencia", "visitas", "solicitudes",
  "fondo", "finanzas", "informe", "equipostats", "reuniones", "miperfil", "cumples",
] as const;

const ModulosSchema = z.object({
  modulos_on: z.array(z.enum(MODULOS_APP)).optional(),
  modulos_off: z.array(z.enum(MODULOS_APP)).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ModulosSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("perfiles")
    .update(parsedBody.data, { count: "exact" })
    .eq("id", params.id)
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("Solo Admin app edita los módulos, o el perfil no existe.", 403);
  return ok(data);
}
