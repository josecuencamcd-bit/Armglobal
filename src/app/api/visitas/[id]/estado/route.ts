import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoVisitaEstado: cambia el estado de una visita y deja constancia en
 * visitas_historial (RLS de visitas_historial exige que la visita referida
 * sea del campus del usuario — ver auth_ve_campus en el join). */
const EstadoSchema = z.object({
  estado: z.enum(["Pendiente", "Contactado", "Agendado", "Reunido", "Sin respuesta"]),
  nota: z.string().trim().max(500).optional(),
  proximo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, EstadoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const id = Number(params.id);
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error, count } = await supabase
    .from("visitas")
    .update(
      {
        estado: parsedBody.data.estado,
        proximo: parsedBody.data.proximo,
        actualizado_por: identidad?.perfil.correo ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { count: "exact" }
    )
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la visita no existe.", 403);

  const { error: eHist } = await supabase.from("visitas_historial").insert({
    visita_id: id,
    estado: parsedBody.data.estado,
    nota: parsedBody.data.nota,
    proximo: parsedBody.data.proximo,
    correo: identidad?.perfil.correo ?? null,
  });
  if (eHist) return fromSupabaseError(eHist);

  return ok(data);
}
