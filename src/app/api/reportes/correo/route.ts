import { createClient } from "@/lib/supabase/server";
import { ok, fail, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { enviarReporte } from "@/lib/email";
import { z } from "zod";

/** "Enviar por correo" del modal de Compartir — cualquier persona logueada
 * puede mandarse a sí misma (o a quien sea) el mismo mensaje que ve en el
 * cuadro de WhatsApp, sin pasar por un rol u área específica. */
const Schema = z.object({
  destinatario: z.string().trim().email({ message: "Correo no válido." }),
  asunto: z.string().trim().min(1).max(200),
  titulo: z.string().trim().min(1).max(200),
  texto: z.string().trim().min(1).max(20000),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, Schema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  try {
    await enviarReporte(parsedBody.data.destinatario, parsedBody.data.asunto, parsedBody.data.titulo, parsedBody.data.texto);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo enviar el correo.", 502);
  }
  return ok({ enviado: true });
}
