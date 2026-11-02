import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo no válido."),
  codigo: z.string().trim().length(6, "El código tiene 6 dígitos."),
  clave: z.string().min(6, "La clave debe tener al menos 6 caracteres.").max(40),
});

const MAX_INTENTOS = 5;

function hashCodigo(correo: string, codigo: string) {
  const secreto = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return crypto.createHmac("sha256", secreto).update(`${correo}:${codigo}`).digest("hex");
}

/**
 * Reemplaza api_restablecer de Code.gs: canjea el código de 6 dígitos (en
 * vez de un token_hash de link) y fija la clave nueva directo con el
 * cliente admin — no hace falta abrir una sesión de recuperación primero,
 * como exigía el flujo de Supabase basado en link.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Schema);
  if ("error" in parsed) return parsed.error;
  const { correo, codigo, clave } = parsed.data;
  const admin = createAdminClient();

  const { data: fila } = await admin
    .from("codigos_recuperacion")
    .select("codigo_hash, expira_en, intentos")
    .eq("correo", correo)
    .maybeSingle();
  if (!fila) return fail("Pide un código nuevo.");

  if (new Date(fila.expira_en).getTime() < Date.now()) {
    await admin.from("codigos_recuperacion").delete().eq("correo", correo);
    return fail("Ese código venció. Pide uno nuevo.");
  }
  if (fila.intentos >= MAX_INTENTOS) {
    await admin.from("codigos_recuperacion").delete().eq("correo", correo);
    return fail("Demasiados intentos. Pide un código nuevo.");
  }

  if (hashCodigo(correo, codigo) !== fila.codigo_hash) {
    await admin.from("codigos_recuperacion").update({ intentos: fila.intentos + 1 }).eq("correo", correo);
    return fail("Código incorrecto.");
  }

  const { data: perfil } = await admin.from("perfiles").select("id").eq("correo", correo).maybeSingle();
  if (!perfil) return fail("Esa cuenta ya no existe.");

  const { error: errClave } = await admin.auth.admin.updateUserById(perfil.id, { password: clave });
  if (errClave) return fail(errClave.message);

  await admin.from("codigos_recuperacion").delete().eq("correo", correo);
  return ok({ actualizado: true });
}
