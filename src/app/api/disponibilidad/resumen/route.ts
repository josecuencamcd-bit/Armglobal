import { createClient } from "@/lib/supabase/server";
import { fail, fromSupabaseError, ok } from "@/lib/api-helpers";
import {
  AREAS_DISPONIBILIDAD,
  CAMPUS_DISPONIBILIDAD,
  SIN_DISPONIBILIDAD,
  encuentrosSemana,
  semanaDe,
} from "@/lib/disponibilidad";

/**
 * GET autenticado (RLS vía sesión): resumen de quién respondió la encuesta
 * de disponibilidad de esta semana para un equipo — usado por "Mi equipo" /
 * Ficha de servicio (Task 4) para armar la ficha solo con gente disponible,
 * y para mostrar el conteo por encuentro + "Sin Disponibilidad" con nombres
 * revelables al tocar.
 *
 * No filtra por área en la policy (disponibilidad_select = auth_ve_campus),
 * así que el filtro por `area` queda acá, igual que ya hace el resto de la
 * app con RLS "amplia por campus + filtro fino en la ruta".
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get("campus");
  const area = searchParams.get("area");

  if (!campus || !CAMPUS_DISPONIBILIDAD.includes(campus as (typeof CAMPUS_DISPONIBILIDAD)[number])) {
    return fail("Campus no válido.");
  }
  if (!area || !AREAS_DISPONIBILIDAD.includes(area as (typeof AREAS_DISPONIBILIDAD)[number])) {
    return fail("Equipo no válido.");
  }
  const campusTyped = campus as (typeof CAMPUS_DISPONIBILIDAD)[number];
  const areaTyped = area as (typeof AREAS_DISPONIBILIDAD)[number];

  const semana = semanaDe(campusTyped);
  const encuentros = encuentrosSemana(campusTyped);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("disponibilidad")
    .select("integrante_id, nombre, encuentros")
    .eq("campus", campusTyped)
    .eq("area", areaTyped)
    .eq("semana", semana);
  if (error) return fromSupabaseError(error);

  const filas = data ?? [];
  const porEncuentro = encuentros.map((e) => ({
    clave: e.clave,
    fecha: e.fecha,
    etiqueta: e.etiqueta,
    disponibles: filas
      .filter((f) => f.encuentros.includes(e.clave))
      .map((f) => ({ id: f.integrante_id, nombre: f.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  }));
  const sinDisponibilidad = filas
    .filter((f) => f.encuentros.includes(SIN_DISPONIBILIDAD))
    .map((f) => ({ id: f.integrante_id, nombre: f.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return ok({ semana, porEncuentro, sinDisponibilidad, totalRespondieron: filas.length });
}
