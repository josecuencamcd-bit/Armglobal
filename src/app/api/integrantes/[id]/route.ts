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
    // Camino 2: equipos además del principal (ver integrante_equipos_extra)
    // — para alguien que sirve en más de un equipo y responde la encuesta
    // de disponibilidad por cada uno. No viaja a la tabla `integrantes`;
    // se sincroniza aparte más abajo.
    equipos_extra: z.array(z.enum(AREAS)).max(AREAS.length).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar." });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, PatchSchema);
  if ("error" in parsedBody) return parsedBody.error;
  const { equipos_extra, ...cambiosIntegrante } = parsedBody.data;
  const id = Number(params.id);

  const supabase = await createClient();

  let data = null;
  if (Object.keys(cambiosIntegrante).length > 0) {
    const { data: actualizado, error, count } = await supabase
      .from("integrantes")
      .update(cambiosIntegrante, { count: "exact" })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return fromSupabaseError(error);
    if (count === 0) return fail("No tienes permiso, o el integrante no existe.", 403);
    data = actualizado;
  }

  if (equipos_extra !== undefined) {
    const { data: integrante, error: errGet } = await supabase
      .from("integrantes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errGet) return fromSupabaseError(errGet);
    if (!integrante) return fail("No tienes permiso, o el integrante no existe.", 403);
    data = data ?? integrante;

    const equipos = [...new Set(equipos_extra)].filter((a) => a !== integrante.area);

    const { error: errDel } = await supabase
      .from("integrante_equipos_extra")
      .delete()
      .eq("integrante_id", id);
    if (errDel) return fromSupabaseError(errDel);

    if (equipos.length > 0) {
      const { error: errIns } = await supabase.from("integrante_equipos_extra").insert(
        equipos.map((area) => ({ integrante_id: id, campus: integrante.campus, area }))
      );
      if (errIns) return fromSupabaseError(errIns);
    }
  }

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
