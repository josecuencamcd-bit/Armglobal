import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/** api_cumpleProps / api_cumplePropGuardar: mensajes propuestos por el
 * vigilante de cumpleaños (cumpleVigilante_) para que un Admin apruebe antes
 * de enviarse por WhatsApp. Lectura abierta; creación solo Admin app
 * (normalmente la hace el cron, con service_role — ver /api/cron/cumpleanos). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cumple_propuestas")
    .select("*")
    .order("fecha", { ascending: true });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
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
