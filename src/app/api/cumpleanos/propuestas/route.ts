import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { cumpleHtml } from "@/lib/cumpleanos";
import { z } from "zod";

/** api_cumpleProps / api_cumplePropGuardar: mensajes propuestos por el
 * vigilante de cumpleaños (cumpleVigilante_) para que un Admin apruebe antes
 * de enviarse por WhatsApp. Lectura abierta; creación solo Admin app
 * (normalmente la hace el cron, con service_role — ver /api/cron/cumpleanos).
 * cumpleVista_: cada fila trae su `html` ya renderizado (tarjeta + mensaje
 * completo) para que Soporte > Cumpleaños muestre la vista previa real,
 * igual que la app vieja, en vez de una lista pelada. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cumple_propuestas")
    .select("*")
    .order("fecha", { ascending: true });
  if (error) return fromSupabaseError(error);
  const conVista = (data ?? []).map((p) => ({ ...p, html: cumpleHtml(p).html }));
  return ok(conVista);
}

const PropuestaSchema = z.object({
  nombres: z.string().trim().min(1).max(200),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  saludo: z.string().trim().max(500).optional(),
  versiculo: z.string().trim().max(500).optional(),
  semilla: z.string().trim().max(500).optional(),
  abrazo: z.string().trim().max(500).optional(),
  gracias: z.string().trim().max(500).optional(),
  mensaje: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, PropuestaSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cumple_propuestas")
    .insert({ ...parsedBody.data, estado: "Pendiente" })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
