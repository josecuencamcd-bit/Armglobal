import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { ArgsSchema, claveSesion } from "@/lib/sesiones";
import { asegurarSesion } from "@/lib/sesiones-db";
import { subirFotoJpeg, borrarFoto, firmarFoto } from "@/lib/fotos";
import { z } from "zod";

/**
 * Fotos del cierre del POS (api_subirFoto / api_delFoto / api_getFoto de
 * Code.gs). Antes vivían en una carpeta de Drive y la columna `fotos` era
 * texto con links separados por espacio; acá `sesiones.fotos` es un
 * text[] de paths dentro del bucket privado "fotos", y las URLs que ve el
 * cliente siempre son firmadas y de corta duración.
 */
const MAX_FOTOS = 6;

function argsDeKey(key: string) {
  const [campus, encuentro, evento, fecha] = key.split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  if (!parsed.success) return null;
  return parsed.data;
}

/** Devuelve los paths guardados junto a una URL firmada para cada uno. */
export async function GET(_req: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  const args = argsDeKey(decodeURIComponent(params.key));
  if (!args) return fail("Encuentro no válido.");

  const supabase = await createClient();
  const key = claveSesion(args);
  // La misma policy de SELECT de `sesiones` decide si este usuario puede
  // ver el encuentro — y por lo tanto sus fotos.
  const { data: sesion, error } = await supabase.from("sesiones").select("fotos").eq("key", key).maybeSingle();
  if (error) return fromSupabaseError(error);

  const paths = sesion?.fotos ?? [];
  const fotos = await Promise.all(
    paths.map(async (path) => ({ path, url: await firmarFoto(path) }))
  );
  return ok({ fotos });
}

const SubirSchema = z.object({ foto: z.string() });

export async function POST(req: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  const args = argsDeKey(decodeURIComponent(params.key));
  if (!args) return fail("Encuentro no válido.");

  const parsedBody = await parseBody(req, SubirSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  try {
    const key = await asegurarSesion(supabase, args);

    const { data: sesion, error: errLeer } = await supabase.from("sesiones").select("fotos").eq("key", key).single();
    if (errLeer) throw errLeer;
    const actuales = sesion.fotos ?? [];
    if (actuales.length >= MAX_FOTOS) return fail(`Ya hay ${MAX_FOTOS} fotos en este encuentro.`);

    const nombre = `${args.campus} - ${args.evento || args.encuentro} - ${args.fecha} - ${Date.now()}.jpg`;
    const path = await subirFotoJpeg(parsedBody.data.foto, "cierres", nombre);

    const { error, count } = await supabase
      .from("sesiones")
      .update({ fotos: [...actuales, path], actualizado: new Date().toISOString() }, { count: "exact" })
      .eq("key", key);
    if (error) throw error;
    if (count === 0) return fail("Este encuentro ya está finalizado.", 403);

    return ok({ path, url: await firmarFoto(path) }, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}

const BorrarSchema = z.object({ path: z.string().min(1) });

export async function DELETE(req: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  const args = argsDeKey(decodeURIComponent(params.key));
  if (!args) return fail("Encuentro no válido.");

  const parsedBody = await parseBody(req, BorrarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const key = claveSesion(args);
  try {
    const { data: sesion, error: errLeer } = await supabase.from("sesiones").select("fotos").eq("key", key).single();
    if (errLeer) throw errLeer;
    const restantes = (sesion.fotos ?? []).filter((p) => p !== parsedBody.data.path);

    const { error, count } = await supabase
      .from("sesiones")
      .update({ fotos: restantes, actualizado: new Date().toISOString() }, { count: "exact" })
      .eq("key", key);
    if (error) throw error;
    if (count === 0) return fail("Este encuentro ya está finalizado.", 403);

    await borrarFoto(parsedBody.data.path);
    return ok({ ok: true });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
