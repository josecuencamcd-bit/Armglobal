import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { esFin } from "@/lib/visibilidad-modulos";
import { z } from "zod";

/**
 * Cierra o reabre la ficha de un servicio+fecha. Cerrada, nadie puede
 * seguir agregando/editando puestos en ninguna área (ver el chequeo en
 * /api/fichas-servicio) hasta que se reabra — pedido explícito de José
 * Miguel: él es el único que cierra y comparte la ficha final.
 */
const Schema = z.object({
  servicio: z.string().trim().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  cerrada: z.boolean(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, Schema);
  if ("error" in parsedBody) return parsedBody.error;
  const { servicio, fecha, cerrada } = parsedBody.data;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  if (!esFin(identidad.perfil)) return fail("Solo un Administrador puede cerrar o reabrir la ficha.", 403);

  const { data, error } = await supabase
    .from("ficha_cabecera")
    .upsert(
      {
        servicio,
        fecha,
        cerrada,
        cerrada_por: cerrada ? identidad.perfil.correo : null,
        cerrada_en: cerrada ? new Date().toISOString() : null,
        actualizado: new Date().toISOString(),
        por: identidad.perfil.correo,
      },
      { onConflict: "servicio,fecha" }
    )
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data);
}
