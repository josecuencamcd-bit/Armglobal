import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { type ArgsEncuentro, claveSesion, equiposVigentes, lunesDe } from "./sesiones";

type DB = SupabaseClient<Database>;

/** Administradores que el pastor de campus asignó en Turnos para la semana
 * de este encuentro (puede ser ninguno). Alimenta el campo Responsable:
 * si hay alguien asignado, el reporte viene precargado con esos nombres en
 * vez de depender de que alguien elija una de las parejas fijas. */
async function turnoDeLaSemana(db: DB, campus: ArgsEncuentro["campus"], fecha: string): Promise<string[]> {
  const { data, error } = await db
    .from("turnos")
    .select("nombres")
    .eq("campus", campus)
    .eq("semana", lunesDe(fecha))
    .maybeSingle();
  if (error) throw error;
  return data?.nombres ?? [];
}

function responsablePorDefecto(turnoNombres: string[]): string {
  return turnoNombres.length ? turnoNombres.join(" y ") : equiposVigentes()[0];
}

/** api_estado: solo lee. Si la sesión no existe todavía, no la crea — igual
 * que leerSesion_() en Code.gs, que devuelve valores por defecto sin tocar
 * la hoja hasta que alguien escribe algo. */
export async function leerSesion(db: DB, args: ArgsEncuentro) {
  const key = claveSesion(args);
  const [{ data: sesion, error: e1 }, { data: asistencia, error: e2 }, { data: voluntarios, error: e3 }, { data: aportes, error: e4 }, turnoAsignado] =
    await Promise.all([
      db.from("sesiones").select("*").eq("key", key).maybeSingle(),
      db.from("sesion_asistencia").select("area, cantidad").eq("sesion_key", key),
      db.from("sesion_voluntarios").select("area, cantidad").eq("sesion_key", key),
      db.from("aportes").select("*").eq("sesion_key", key).order("creado_en", { ascending: true }),
      turnoDeLaSemana(db, args.campus, args.fecha),
    ]);
  for (const e of [e1, e2, e3, e4]) if (e) throw e;
  return {
    key,
    responsable: sesion?.responsable ?? responsablePorDefecto(turnoAsignado),
    // Nombres asignados en Turnos esa semana — si viene vacío, la pantalla
    // cae a la lista tradicional de equipos para elegir una sola opción.
    turnoAsignado,
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
  const turnoAsignado = await turnoDeLaSemana(db, args.campus, args.fecha);
  const { error } = await db.from("sesiones").upsert(
    {
      key,
      campus: args.campus,
      encuentro: args.encuentro,
      evento: args.evento || null,
      fecha: args.fecha,
      responsable: responsablePorDefecto(turnoAsignado),
    },
    { onConflict: "key", ignoreDuplicates: true }
  );
  if (error) throw error;
  return key;
}
