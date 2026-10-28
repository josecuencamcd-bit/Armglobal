import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { type ArgsEncuentro, claveSesion, equiposVigentes } from "./sesiones";

type DB = SupabaseClient<Database>;

/** api_estado: solo lee. Si la sesión no existe todavía, no la crea — igual
 * que leerSesion_() en Code.gs, que devuelve valores por defecto sin tocar
 * la hoja hasta que alguien escribe algo. */
export async function leerSesion(db: DB, args: ArgsEncuentro) {
  const key = claveSesion(args);
  const [{ data: sesion, error: e1 }, { data: asistencia, error: e2 }, { data: voluntarios, error: e3 }, { data: aportes, error: e4 }] =
    await Promise.all([
      db.from("sesiones").select("*").eq("key", key).maybeSingle(),
      db.from("sesion_asistencia").select("area, cantidad").eq("sesion_key", key),
      db.from("sesion_voluntarios").select("area, cantidad").eq("sesion_key", key),
      db.from("aportes").select("*").eq("sesion_key", key).order("creado_en", { ascending: true }),
    ]);
  for (const e of [e1, e2, e3, e4]) if (e) throw e;
  return {
    key,
    responsable: sesion?.responsable ?? equiposVigentes()[0],
    finalizado: sesion?.finalizado ?? false,
    sesion,
    asistencia: asistencia ?? [],
    voluntarios: voluntarios ?? [],
    aportes: aportes ?? [],
  };
}

/** Equivalente a sesionEditable_(): crea la fila si no existe todavía
 * (RLS decide si el usuario puede hacerlo — ver policy sesiones_insert).
 * A diferencia de Code.gs, la validación de "editable" (no finalizado, o
 * con autorización vigente) ya la hace la policy `sesiones_update` por sí
 * sola: si el update es rechazado, Postgres devuelve 0 filas afectadas y
 * la ruta lo traduce a 403. */
export async function asegurarSesion(db: DB, args: ArgsEncuentro) {
  const key = claveSesion(args);
  const { error } = await db.from("sesiones").upsert(
    {
      key,
      campus: args.campus,
      encuentro: args.encuentro,
      evento: args.evento || null,
      fecha: args.fecha,
      responsable: equiposVigentes()[0],
    },
    { onConflict: "key", ignoreDuplicates: true }
  );
  if (error) throw error;
  return key;
}
