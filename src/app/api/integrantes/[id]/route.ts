import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { AREAS } from "@/lib/sesiones";
import { z } from "zod";

const PatchSchema = z
  .object({
    area: z.enum(AREAS).optional(),
    nombre: z.string().trim().min(1).max(120).optional(),
    telefono: z.string().trim().max(30).optional(),
    correo: z.string().trim().email().optional().or(z.literal("")),
    nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    anos_iglesia: z.number().int().min(0).max(120).optional(),
    anos_servicio: z.number().int().min(0).max(120).optional(),
    rol_servicio: z.string().trim().max(60).optional(),
    profesion: z.string().trim().max(120).optional(),
    estado: z.string().trim().max(40).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar." });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, PatchSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("integrantes")
    .update(parsedBody.data, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el integrante no existe.", 403);
  return ok(data);
}

/** Code.gs no borra integrantes de verdad (usa `estado`), así que DELETE
 * aquí es una conveniencia que marca estado="Inactivo" en vez de un
 * DELETE real — mantiene el historial de seguimiento intacto. */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("integrantes")
    .update({ estado: "Inactivo" }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el integrante no existe.", 403);
  return ok(data);
}
