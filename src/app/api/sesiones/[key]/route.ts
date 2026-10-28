import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { ArgsSchema, SetCampoBodySchema, validarCampo, claveSesion } from "@/lib/sesiones";
import { leerSesion, asegurarSesion } from "@/lib/sesiones-db";
import type { Database } from "@/lib/supabase/types";

/**
 * Un "encuentro" (antes: fila en "Sesiones - <campus>"). La clave de la URL
 * es la misma que usaba Code.gs: campus|encuentro|evento|fecha, codificada
 * como un solo segmento de ruta (Next.js la decodifica solo).
 *
 * GET    → equivalente a api_estado (solo lectura, no crea nada)
 * PATCH  → equivalente a api_setCampo (crea la fila si hace falta y RLS lo permite)
 */
function argsDeKey(key: string) {
  const [campus, encuentro, evento, fecha] = key.split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  if (!parsed.success) return null;
  return parsed.data;
}

export async function GET(_req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const args = argsDeKey(decodeURIComponent(params.key));
  if (!args) return fail("Encuentro no válido.");

  const supabase = await createClient();
  try {
    const estado = await leerSesion(supabase, args);
    return ok(estado);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const args = argsDeKey(decodeURIComponent(params.key));
  if (!args) return fail("Encuentro no válido.");

  const parsedBody = await parseBody(req, SetCampoBodySchema);
  if ("error" in parsedBody) return parsedBody.error;

  let valorNormalizado: string | number;
  try {
    valorNormalizado = validarCampo(parsedBody.data.campo, parsedBody.data.valor);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = await createClient();
  try {
    const key = await asegurarSesion(supabase, args);

    // asis_*/vol_* viven en sus propias tablas (conteo por área), el resto
    // son columnas directas de `sesiones`.
    const campo = parsedBody.data.campo;
    if (campo.startsWith("asis_")) {
      const { error } = await supabase
        .from("sesion_asistencia")
        .upsert({ sesion_key: key, area: campo.slice(5), cantidad: Number(valorNormalizado) });
      if (error) throw error;
    } else if (campo.startsWith("vol_")) {
      const { error } = await supabase
        .from("sesion_voluntarios")
        .upsert({ sesion_key: key, area: campo.slice(4), cantidad: Number(valorNormalizado) });
      if (error) throw error;
    } else {
      const columna = campo === "aceptaron" ? "aceptaron" : campo === "onAcepto" ? "on_acepto" : campo === "onEspect" ? "on_espect" : campo;
      const cambios = { [columna]: valorNormalizado, actualizado: new Date().toISOString() } as Database["public"]["Tables"]["sesiones"]["Update"];
      const { error, count } = await supabase
        .from("sesiones")
        .update(cambios, { count: "exact" })
        .eq("key", key);
      if (error) throw error;
      if (count === 0) return fail("Este encuentro ya está finalizado.", 403);
    }

    const estado = await leerSesion(supabase, args);
    return ok(estado);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
