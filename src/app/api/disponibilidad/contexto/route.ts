import {
  CAMPUS_DISPONIBILIDAD,
  AREAS_DISPONIBILIDAD,
  encuentrosSemana,
  encuestaAbierta,
  MENSAJE_ENCUESTA_CERRADA,
  semanaDe,
} from "@/lib/disponibilidad";
import { fail, ok } from "@/lib/api-helpers";

/**
 * GET público (sin sesión) para armar el primer paso del formulario: lista
 * de campus/equipos, y para el campus elegido, los encuentros reales de
 * esta semana ya con fecha y etiqueta ("Jueves 12/11/26 6pm 🤘").
 *
 * Sin parámetro `campus`: solo campus + áreas (para los selectores). Con
 * `campus`: además los encuentros de esa semana y la clave `semana`.
 *
 * `abierta`: si la encuesta está dentro de su ventana (viernes 8am a
 * miércoles 8pm) — el formulario usa esto para mostrar el aviso de cerrada
 * en vez de dejar responder, sin importar en qué paso esté.
 */
export async function GET(req: Request) {
  const campus = new URL(req.url).searchParams.get("campus");
  const abierta = encuestaAbierta();

  if (!campus) {
    return ok({ campus: CAMPUS_DISPONIBILIDAD, areas: AREAS_DISPONIBILIDAD, abierta, mensajeCerrada: MENSAJE_ENCUESTA_CERRADA });
  }

  if (!CAMPUS_DISPONIBILIDAD.includes(campus as (typeof CAMPUS_DISPONIBILIDAD)[number])) {
    return fail("Campus no válido.");
  }
  const campusTyped = campus as (typeof CAMPUS_DISPONIBILIDAD)[number];

  return ok({
    campus: CAMPUS_DISPONIBILIDAD,
    areas: AREAS_DISPONIBILIDAD,
    semana: semanaDe(campusTyped),
    encuentros: encuentrosSemana(campusTyped),
    abierta,
    mensajeCerrada: MENSAJE_ENCUESTA_CERRADA,
  });
}
