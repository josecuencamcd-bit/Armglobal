import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** "Entrada" (cargar stock) o "Venta" (rebaja stock sola y congela el
 * precio/monto de esa venta para el informe de ingresos). Mismo patrón que
 * /api/merch/articulos/movimiento pero para el catálogo general — todo el
 * trabajo (lock + update stock + insertar en el ledger) lo hace
 * merch_producto_registrar_movimiento() en una sola transacción. */
const MovimientoSchema = z.object({
  cantidad: z.number().int().min(1).max(1_000_000),
  tipo_mov: z.enum(["Entrada", "Venta"], { error: () => "Tipo de movimiento no válido." }),
  nota: z.string().trim().max(300).optional(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsedBody = await parseBody(req, MovimientoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const { data, error } = await supabase.rpc("merch_producto_registrar_movimiento", {
    p_producto_id: Number(params.id),
    p_cantidad: parsedBody.data.cantidad,
    p_tipo_mov: parsedBody.data.tipo_mov,
    p_nota: parsedBody.data.nota ?? "",
    p_por: identidad.perfil.correo,
  });
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
