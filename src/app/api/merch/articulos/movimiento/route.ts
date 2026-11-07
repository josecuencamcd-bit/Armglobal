import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, TALLAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/**
 * "Entrada" (cargar inventario) o "Venta" (registrar una venta — rebaja
 * stock sola). "Entrega" la dispara el propio PATCH de
 * /api/merch/solicitudes/[id] al marcar una solicitud como entregada, no
 * entra por acá. Todo el trabajo (upsert del artículo + ajustar stock +
 * dejar registro en merch_movimientos, bloqueando la fila mientras tanto)
 * lo hace merch_registrar_movimiento() en la base, en una sola transacción.
 */
const MovimientoSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  tipo: z.enum(["Polera", "Polerón"], { error: () => "Elige polera o polerón." }),
  talla: z.enum(TALLAS, { error: () => "Talla no válida." }),
  cantidad: z.number().int().min(1).max(10_000),
  tipo_mov: z.enum(["Entrada", "Venta"], { error: () => "Tipo de movimiento no válido." }),
  nota: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, MovimientoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const { data, error } = await supabase.rpc("merch_registrar_movimiento", {
    p_campus: parsedBody.data.campus,
    p_tipo: parsedBody.data.tipo,
    p_talla: parsedBody.data.talla,
    p_cantidad: parsedBody.data.cantidad,
    p_tipo_mov: parsedBody.data.tipo_mov,
    p_nota: parsedBody.data.nota ?? "",
    p_por: identidad.perfil.correo,
  });
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
