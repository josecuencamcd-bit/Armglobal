import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { esFin } from "@/lib/visibilidad-modulos";
import { CAMPUS, lunesDe } from "@/lib/sesiones";
import { fichaTecnicaDeServicio } from "@/lib/ficha-tecnica";
import { z } from "zod";

/** "Domingo 11am" → "11:00 am" / "Jueves 8pm" → "08:00 pm" — el horario ya
 * va codificado en el nombre del servicio, no hace falta guardarlo aparte. */
function horarioDeServicio(servicio: string): string {
  const m = servicio.match(/(\d{1,2})(am|pm)$/i);
  if (!m) return "";
  const hora = m[1].padStart(2, "0");
  return `${hora}:00 ${m[2].toLowerCase()}`;
}

/**
 * Cabecera de la ficha completa (todas las áreas): combina tres fuentes.
 * Automático de la DB: administradores de campus (Administración semanal),
 * pastores de campus (por rol), horario (del nombre del servicio).
 * Automático de la planilla técnica (en vivo, ver ficha-tecnica.ts):
 * predicador, siembra, despedida, producción — el equipo técnico la llena
 * y acá se copia sola, sin volver a escribirla.
 * Manual, guardado en `ficha_cabecera`: líder de Voluntariado, Stand AR
 * Merch, Stand APLC (hasta que esos equipos tengan su propia área con
 * ficha, como Voluntariado) — y fallback si la planilla no respondió.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const servicio = searchParams.get("servicio");
  const fecha = searchParams.get("fecha");
  if (!servicio) return fail("Falta el servicio.", 400);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fail("Fecha no válida.", 400);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus")) ?? CAMPUS[0];

  const supabase = await createClient();
  const semana = lunesDe(fecha);

  const [{ data: cabecera, error: e1 }, { data: admin, error: e2 }, { data: pastores, error: e3 }, tecnica] = await Promise.all([
    supabase.from("ficha_cabecera").select("*").eq("servicio", servicio).eq("fecha", fecha).maybeSingle(),
    supabase.from("administracion_semanal").select("nombres").eq("campus", campus).eq("semana", semana).maybeSingle(),
    supabase
      .from("perfiles")
      .select("nombre, roles, campus")
      .or(`campus.eq.${campus},campus.is.null`)
      .contains("roles", ["Pastor de campus"]),
    fichaTecnicaDeServicio(servicio),
  ]);
  if (e1) return fromSupabaseError(e1);
  if (e2) return fromSupabaseError(e2);
  if (e3) return fromSupabaseError(e3);

  const pastoresNombres = (pastores ?? []).map((p) => p.nombre);

  return ok({
    cabecera: cabecera ?? null,
    administradoresCampus: admin?.nombres ?? [],
    pastoresCampus: pastoresNombres,
    horario: horarioDeServicio(servicio),
    // Si la planilla técnica no respondió (red, hoja sin mapear), cada
    // campo cae a lo guardado manual en ficha_cabecera, y despedida cae a
    // los pastores de campus.
    predicador: tecnica?.predicador || cabecera?.predicador || "",
    siembra: tecnica?.siembra || cabecera?.siembra || "",
    despedida: tecnica?.despedida || (pastoresNombres.length > 0 ? pastoresNombres.join(" y ") : ""),
    productorGeneral: tecnica?.productorGeneral || cabecera?.productor_general || "",
    encargadosTecnicos: tecnica?.encargadosTecnicos || cabecera?.encargados_tecnicos || "",
    productorEncuentro: tecnica?.productorEncuentro || cabecera?.productor_responsable || "",
    deTecnica: !!tecnica,
  });
}

const GuardarSchema = z.object({
  servicio: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  predicador: z.string().trim().max(200).optional(),
  lider_voluntariado: z.string().trim().max(200).optional(),
  productor_general: z.string().trim().max(200).optional(),
  encargados_tecnicos: z.string().trim().max(200).optional(),
  productor_responsable: z.string().trim().max(200).optional(),
  siembra: z.string().trim().max(200).optional(),
  stand_merch: z.string().trim().max(200).optional(),
  stand_aplc: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, GuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  if (!esFin(identidad.perfil)) return fail("No tienes permiso para editar la ficha.", 403);

  const { data, error } = await supabase
    .from("ficha_cabecera")
    .upsert(
      {
        ...parsedBody.data,
        actualizado: new Date().toISOString(),
        por: identidad.perfil.correo,
      },
      { onConflict: "servicio,fecha" }
    )
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
