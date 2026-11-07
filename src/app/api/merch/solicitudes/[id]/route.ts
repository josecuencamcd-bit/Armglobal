import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** Resuelve una solicitud de merch: aprobar/rechazar/marcar entregada.
 * Gate real está en RLS (merch_solicitudes_update: Finanzas o área
 * "Merch" solamente) — si alguien más llama esto, count queda en 0. */
const ResolverSchema = z.object({
  estado: z.enum(["Aprobada", "Rechazada", "Entregada"], { error: () => "Estado no válido." }),
  nota: z.string().trim().max(300).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error, count } = await supabase
    .from("merch_solicitudes")
    .update(
      {
        ...parsedBody.data,
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
  return ok(data);
}
