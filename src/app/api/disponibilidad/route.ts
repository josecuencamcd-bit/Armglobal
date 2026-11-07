import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, fromSupabaseError, ok, parseBody } from "@/lib/api-helpers";
import {
  AREAS_DISPONIBILIDAD,
  CAMPUS_DISPONIBILIDAD,
  SIN_DISPONIBILIDAD,
  encuentrosSemana,
  semanaDe,
} from "@/lib/disponibilidad";

const DisponibilidadSchema = z.object({
  campus: z.enum(CAMPUS_DISPONIBILIDAD, { error: () => "Campus no válido." }),
  area: z.enum(AREAS_DISPONIBILIDAD, { error: () => "Equipo no válido." }),
  integranteId: z.number().int().positive(),
  nombre: z.string().trim().min(1).max(120),
  encuentros: z.array(z.string()).max(10),
});

/**
 * POST público (sin sesión): registra/actualiza la disponibilidad de la
 * semana. Mismo patrón que /api/solicitudes-acceso — usa el cliente admin
 * porque quien responde no tiene cuenta en la app.
 *
 * `encuentros` trae las claves reales de ENCUENTROS (ej. "Jueves PM") o,
 * si la persona marcó que no tiene disponibilidad, un único elemento
 * SIN_DISPONIBILIDAD — nunca combinado con encuentros reales (ver
 * encuentrosSemana/SIN_DISPONIBILIDAD en src/lib/disponibilidad.ts).
 *
 * Upsert por (integrante_id, semana): si la persona ya respondió esta
 * semana y vuelve a enviar (cambio de último momento), se reemplaza su
 * respuesta en vez de duplicarla.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, DisponibilidadSchema);
  if ("error" in parsed) return parsed.error;
  const { campus, area, integranteId, encuentros } = parsed.data;

  const clavesValidas = new Set(encuentrosSemana(campus).map((e) => e.clave));
  const limpio = encuentros.includes(SIN_DISPONIBILIDAD)
    ? [SIN_DISPONIBILIDAD]
    : encuentros.filter((e) => clavesValidas.has(e));
  if (limpio.length === 0) return fail("Marca al menos una opción.");

  const admin = createAdminClient();

  // Confirma que el integrante es real y pertenece a ese campus/equipo —
  // nunca confiamos en lo que venga del navegador para estos tres campos.
  const { data: integrante, error: errInt } = await admin
    .from("integrantes")
    .select("id, nombre")
    .eq("id", integranteId)
    .eq("campus", campus)
    .eq("area", area)
    .neq("estado", "Baja")
    .maybeSingle();
  if (errInt) return fromSupabaseError(errInt);
  if (!integrante) return fail("No encontramos a esa persona en ese equipo.");

  const semana = semanaDe(campus);
  const { error } = await admin.from("disponibilidad").upsert(
    {
      campus,
      area,
      integrante_id: integrante.id,
      nombre: integrante.nombre,
      semana,
      encuentros: limpio,
    },
    { onConflict: "integrante_id,semana" }
  );
  if (error) return fromSupabaseError(error);

  return ok({ guardado: true, nombre: integrante.nombre }, 201);
}
