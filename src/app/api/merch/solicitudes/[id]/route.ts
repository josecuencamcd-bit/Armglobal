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
  if (!identidad) return fail("No autenticado.", 401);

  // Marcar "Entregada" rebaja el inventario de verdad (merch_registrar_movimiento,
  // tipo_mov="Entrega") ANTES de tocar la solicitud — si no hay stock suficiente,
  // la solicitud se queda como estaba en vez de quedar "Entregada" mintiendo
  // sobre un inventario que no existe.
  if (parsedBody.data.estado === "Entregada") {
    const { data: solicitud, error: errGet } = await supabase
      .from("merch_solicitudes")
      .select("campus, tipo, talla, cantidad")
      .eq("id", Number(params.id))
      .maybeSingle();
    if (errGet) return fromSupabaseError(errGet);
    if (!solicitud) return fail("No tienes permiso, o la solicitud no existe.", 403);

    const { error: errMov } = await supabase.rpc("merch_registrar_movimiento", {
      p_campus: solicitud.campus,
      p_tipo: solicitud.tipo,
      p_talla: solicitud.talla,
      p_cantidad: solicitud.cantidad,
      p_tipo_mov: "Entrega",
      p_nota: `Solicitud #${params.id}`,
      p_por: identidad.perfil.correo,
    });
    if (errMov) return fromSupabaseError(errMov);
  }

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
