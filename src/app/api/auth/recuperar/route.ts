import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreoRecuperarClave, APP_URL } from "@/lib/email";
import { ok, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({ correo: z.string().trim().email() });

/**
 * Reemplaza api_olvide de Code.gs. No usamos supabase.auth.resetPasswordForEmail
 * (dispara el mailer nativo de Supabase, con plantilla genérica y límite de
 * 2/hora en el plan free) ni el action_link que arma generateLink (ese pasa
 * por el endpoint /auth/v1/verify de Supabase, que recorta el redirectTo a
 * la raíz del dominio sin importar la configuración de Redirect URLs —
 * comprobado en pruebas directas). En vez de eso armamos nuestro propio
 * link con el hashed_token que generateLink también devuelve, y
 * /actualizar-clave lo valida directo con verifyOtp, sin pasar por ese
 * redirect.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Schema);
  if ("error" in parsed) return parsed.error;

  // Todo lo de acá para adentro puede fallar por motivos ajenos al usuario
  // (red, Resend) — nunca debe traducirse en un 500 que delate si el
  // correo existe o no.
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.correo,
      options: { redirectTo: APP_URL },
    });
    if (!error && data?.properties?.hashed_token) {
      const link = `${APP_URL}/actualizar-clave?token_hash=${data.properties.hashed_token}&type=recovery`;
      await enviarCorreoRecuperarClave(parsed.data.correo, link);
    }
  } catch {
    // seguimos igual: no delatamos fallos de envío al cliente
  }
  return ok({ enviado: true });
}
