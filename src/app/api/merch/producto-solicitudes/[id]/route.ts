import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** Resuelve una solicitud de compra: Entregada o Rechazada. Gate real está
 * en RLS (merch_producto_solicitudes_update: Finanzas o área "Merch").
 * Marcar "Entregada" registra la venta de verdad (rebaja stock y congela
 * el precio para el informe) ANTES de tocar la solicitud — si no hay stock
 * suficiente, la solicitud se queda como estaba en vez de mentir sobre un
 * inventario que no existe. */
const ResolverSchema = z.object({
  estado: z.enum(["Entregada", "Rechazada"], { error: () => "Estado no válido." }),
  nota: z.string().trim().max(300).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  if (parsedBody.data.estado === "Entregada") {
    const { data: solicitud, error: errGet } = await supabase
      .from("merch_producto_solicitudes")
      .select("producto_id, cantidad")
      .eq("id", Number(params.id))
      .maybeSingle();
    if (errGet) return fromSupabaseError(errGet);
    if (!solicitud) return fail("No tienes permiso, o la solicitud no existe.", 403);

    const { error: errMov } = await supabase.rpc("merch_producto_registrar_movimiento", {
      p_producto_id: solicitud.producto_id,
      p_cantidad: solicitud.cantidad,
      p_tipo_mov: "Venta",
      p_nota: `Solicitud #${params.id}`,
      p_por: identidad.perfil.correo,
    });
    if (errMov) return fromSupabaseError(errMov);
  }

  const { data, error, count } = await supabase
    .from("merch_producto_solicitudes")
    .update(
      { ...parsedBody.data, resuelto_por: identidad.perfil.correo, resuelto_en: new Date().toISOString() },
      { count: "exact" }
    )
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la solicitud no existe.", 403);
  return ok(data);
}
