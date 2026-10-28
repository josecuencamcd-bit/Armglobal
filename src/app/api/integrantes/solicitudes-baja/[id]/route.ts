import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoResolver: aprueba o rechaza una solicitud de baja. Si se aprueba,
 * además marca el integrante como Inactivo (mismo efecto que el DELETE
 * lógico de /api/integrantes/[id]). */
const ResolverSchema = z.object({ aprobar: z.boolean() });

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error, count } = await supabase
    .from("solicitudes_baja")
    .update(
      {
        estado: parsedBody.data.aprobar ? "Aprobada" : "Rechazada",
        resuelto_por: identidad?.perfil.correo ?? null,
        resuelto_en: new Date().toISOString(),
      },
      { count: "exact" }
    )
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la solicitud no existe.", 403);

  if (parsedBody.data.aprobar && data?.integrante_id) {
    await supabase.from("integrantes").update({ estado: "Inactivo" }).eq("id", data.integrante_id);
  }
  return ok(data);
}
