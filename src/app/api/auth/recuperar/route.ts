import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoRecuperarClave } from "@/lib/email";
import { ok, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({ correo: z.string().trim().email() });

/**
 * Reemplaza api_olvide de Code.gs. No usamos supabase.auth.resetPasswordForEmail
 * (dispara el mailer nativo de Supabase, con plantilla genérica y límite de
 * 2/hora en el plan free): generamos el link nosotros con el cliente admin
 * (service_role) y lo mandamos con nuestro propio HTML vía Resend.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Schema);
  if ("error" in parsed) return parsed.error;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.correo,
    options: { redirectTo: "https://armglobal-jmnexia.vercel.app/actualizar-clave" },
  });

  // No revelamos si el correo existe o no (evita enumerar cuentas) — siempre
  // respondemos ok, pero solo mandamos el correo si realmente hay cuenta.
  if (!error && data?.properties?.action_link) {
    try {
      await enviarCorreoRecuperarClave(parsed.data.correo, data.properties.action_link);
    } catch {
      // seguimos igual: no delatamos fallos de envío al cliente
    }
  }
  return ok({ enviado: true });
}
