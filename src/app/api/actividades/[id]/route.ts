import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

const PatchSchema = z.object({
  estado: z.enum(["Pendiente", "Hecha"]),
});

/** Marcar una actividad como Hecha (o reabrirla) — RLS (actividades_equipo_update)
 * exige ser el Líder del área o Administrador/Pastor/Ministro del campus. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail("Actividad no válida.");

  const parsedBody = await parseBody(req, PatchSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const cambios =
    parsedBody.data.estado === "Hecha"
      ? { estado: "Hecha", hecha_en: new Date().toISOString(), hecha_por: identidad.perfil.correo }
      : { estado: "Pendiente", hecha_en: null, hecha_por: null };

  const { error, count } = await supabase
    .from("actividades_equipo")
    .update(cambios, { count: "exact" })
    .eq("id", id);
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso para esta acción.", 403);
  return ok({ id, ...cambios });
}
