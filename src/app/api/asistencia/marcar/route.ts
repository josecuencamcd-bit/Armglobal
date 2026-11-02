import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { ctxAsistencia, claveNota, campusValido, areaValida, ESTADOS_ASIS } from "@/lib/asistencia";
import { z } from "zod";

/** api_ecoMarcar: marca Vino/No vino (o Avisó) + observación de una persona
 * ya programada ese día. "" limpia la marca (igual que tocar de nuevo el
 * mismo botón en la app vieja). */
const Schema = z.object({
  campus: z.string(),
  area: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  integranteId: z.number().int(),
  estado: z.union([z.enum(ESTADOS_ASIS), z.literal("")]),
  obs: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, Schema);
  if ("error" in parsedBody) return parsedBody.error;
  const { campus, area, fecha, integranteId, estado, obs } = parsedBody.data;
  if (!campusValido(campus)) return fail("Campus no válido.", 400);
  if (!areaValida(area)) return fail("Área no válida.", 400);

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const { lider } = ctxAsistencia(identidad.perfil, campus, area);
  if (!lider) return fail("Esta acción es solo del líder del área.", 403);

  try {
    const { data: notaRow, error: eNota } = await supabase.from("notas").select("finalizado").eq("key", claveNota(campus, area, fecha)).maybeSingle();
    if (eNota) throw eNota;
    if (notaRow?.finalizado) return fail("Este encuentro ya fue finalizado.", 409);

    const { data: fila, error: eFila } = await supabase
      .from("integrante_seguimiento")
      .select("id")
      .eq("campus", campus)
      .eq("area", area)
      .eq("fecha", fecha)
      .eq("integrante_id", integranteId)
      .maybeSingle();
    if (eFila) throw eFila;
    if (!fila) return fail("Esa persona no está programada.", 404);

    const { data, error } = await supabase
      .from("integrante_seguimiento")
      .update({ estado, observacion: obs ?? "", marcado_por: identidad.perfil.correo })
      .eq("id", fila.id)
      .select()
      .single();
    if (error) throw error;
    return ok(data);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
