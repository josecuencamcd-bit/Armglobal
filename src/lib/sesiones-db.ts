import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { type ArgsEncuentro, claveSesion, equiposVigentes, lunesDe } from "./sesiones";

type DB = SupabaseClient<Database>;

/** Administradores que el pastor de campus asignó en Administración
 * semanal para la semana de este encuentro (puede ser ninguno). Alimenta
 * el campo Responsable: si hay alguien asignado, el reporte viene
 * precargado con esos nombres en vez de depender de que alguien elija una
 * de las parejas fijas. */
export async function administracionDeLaSemana(db: DB, campus: ArgsEncuentro["campus"], fecha: string): Promise<string[]> {
  const { data, error } = await db
    .from("administracion_semanal")
    .select("nombres")
    .eq("campus", campus)
    .eq("semana", lunesDe(fecha))
    .maybeSingle();
  if (error) throw error;
  return data?.nombres ?? [];
}

function responsablePorDefecto(administracionNombres: string[]): string {
  return administracionNombres.length ? administracionNombres.join(" y ") : equiposVigentes()[0];
}

/** api_estado: solo lee. Si la sesión no existe todavía, no la crea — igual
 * que leerSesion_() en Code.gs, que devuelve valores por defecto sin tocar
 * la hoja hasta que alguien escribe algo. */
export async function leerSesion(db: DB, args: ArgsEncuentro) {
  const key = claveSesion(args);
  const [{ data: sesion, error: e1 }, { data: asistencia, error: e2 }, { data: voluntarios, error: e3 }, { data: aportes, error: e4 }, administracionAsignada] =
    await Promise.all([
      db.from("sesiones").select("*").eq("key", key).maybeSingle(),
      db.from("sesion_asistencia").select("area, cantidad").eq("sesion_key", key),
      db.from("sesion_voluntarios").select("area, cantidad").eq("sesion_key", key),
      db.from("aportes").select("*").eq("sesion_key", key).order("creado_en", { ascending: true }),
      administracionDeLaSemana(db, args.campus, args.fecha),
    ]);
  for (const e of [e1, e2, e3, e4]) if (e) throw e;
  return {
    key,
    responsable: sesion?.responsable ?? responsablePorDefecto(administracionAsignada),
    // Nombres asignados en Administración semanal esa semana — si viene
    // vacío, la pantalla cae a la lista tradicional de equipos para elegir
    // una sola opción.
    administracionAsignada,
    // Tres cierres independientes: "finalizado" es el del Reporte general
    // (asistencia/voluntarios/aceptaron), "aportesFinalizado" es el de
    // Aportes, "checklistFinalizado" es el del Checklist pre-encuentro —
    // cada administrador cierra su parte cuando termina, sin depender de
    // que las otras también estén listas. El encuentro completo (lo que
    // revisa el vigilante automático) recién se da por cerrado cuando las
    // tres lo están.
    finalizado: sesion?.finalizado ?? false,
    aportesFinalizado: sesion?.aportes_finalizado ?? false,
    checklistFinalizado: sesion?.checklist_finalizado ?? false,
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

  // La gran mayoría de las veces el encuentro ya existe (alguien ya guardó
  // algo antes) — esta sola columna evita, en ese caso, la consulta extra a
  // administracion_semanal que solo hace falta para el valor por defecto de
  // "responsable" cuando la fila se crea por primera vez.
  const { data: existente, error: eExiste } = await db.from("sesiones").select("key").eq("key", key).maybeSingle();
  if (eExiste) throw eExiste;
  if (existente) return key;

  const administracionAsignada = await administracionDeLaSemana(db, args.campus, args.fecha);
  const { error } = await db.from("sesiones").upsert(
    {
      key,
      campus: args.campus,
      encuentro: args.encuentro,
      evento: args.evento || null,
      fecha: args.fecha,
      responsable: responsablePorDefecto(administracionAsignada),
    },
    { onConflict: "key", ignoreDuplicates: true }
  );
  if (error) throw error;
  return key;
}
