import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCodigoRecuperarClave } from "@/lib/email";
import { ok, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({ correo: z.string().trim().toLowerCase().email("Correo no válido.") });

const VENCE_MIN = 15;

function hashCodigo(correo: string, codigo: string) {
  const secreto = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return crypto.createHmac("sha256", secreto).update(`${correo}:${codigo}`).digest("hex");
}

/**
 * Reemplaza api_olvide de Code.gs: genera un código de 6 dígitos y lo manda
 * por correo, en vez del link de recuperación nativo de Supabase (que
 * Supabase solo sabe canjear con un token largo, no con un código corto
 * que la persona pueda escribir a mano). Guardamos solo el hash en
 * codigos_recuperacion (service-role, sin policies — ver migración
 * codigos_recuperacion_clave).
 *
 * Responde {enviado:true} siempre que el correo tenga cuenta, para no
 * delatar por timing si existe o no; si no tiene cuenta no mandamos nada
 * pero igual respondemos ok (este endpoint solo se llama desde el paso
 * "entrar", después de que /api/auth/correo ya confirmó que existe).
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Schema);
  if ("error" in parsed) return parsed.error;
  const correo = parsed.data.correo;
  const admin = createAdminClient();

  const { data: perfil } = await admin.from("perfiles").select("id").eq("correo", correo).maybeSingle();
  if (!perfil) return ok({ enviado: true });

  const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const codigo_hash = hashCodigo(correo, codigo);
  const expira_en = new Date(Date.now() + VENCE_MIN * 60_000).toISOString();

  const { error } = await admin
    .from("codigos_recuperacion")
    .upsert({ correo, codigo_hash, expira_en, intentos: 0 }, { onConflict: "correo" });
  if (error) return ok({ enviado: true }); // no delatamos fallos internos al cliente

  try {
    await enviarCodigoRecuperarClave(correo, codigo);
  } catch {
    // seguimos igual: no delatamos fallos de envío al cliente
  }
  return ok({ enviado: true });
}
