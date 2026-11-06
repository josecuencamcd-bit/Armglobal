import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";

/**
 * Equivalente a marcarPresencia_()/conectados_() de Code.gs: en la app
 * vieja cada llamada a api_estado refrescaba la marca de la persona por
 * 50 segundos en CacheService (memoria del servidor de Apps Script) y
 * devolvía la lista completa de quién seguía marcado. Acá no hay esa
 * caché de servidor, así que usamos una fila por persona en `presencia`
 * (upsert en cada llamada) y consideramos "en línea" a quien tenga
 * actualizado_en dentro de los últimos 50 segundos — el cliente llama
 * este endpoint cada ~20-25s mientras está con sesión abierta.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  // Se marca con la identidad REAL (no la impersonada): esto responde
  // "quién está conectado de verdad en este momento", no a nombre de quién
  // está actuando.
  const { error: upsertError } = await supabase.from("presencia").upsert({
    id: identidad.real.id,
    nombre: identidad.real.nombre,
    campus: identidad.real.campus,
    actualizado_en: new Date().toISOString(),
  });
  if (upsertError) return fromSupabaseError(upsertError);

  const hace50s = new Date(Date.now() - 50_000).toISOString();
  const { data, error } = await supabase
    .from("presencia")
    .select("nombre, campus")
    .gte("actualizado_en", hace50s)
    .order("nombre");
  if (error) return fromSupabaseError(error);

  return ok({ conectados: data ?? [] });
}
