import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { avisarActividad } from "@/lib/email";
import { z } from "zod";

function fechaLegible(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * "Asignación de actividades" dentro de Mi equipo: un Líder le encarga algo
 * puntual a alguien de su área ("María coordina tal cosa esta semana"), con
 * fecha límite — no requiere que la persona tenga cuenta en la app, se
 * avisa directo a su correo. RLS (actividades_equipo_select/insert/update)
 * ya resuelve el alcance: un Líder solo ve/crea en sus propias áreas
 * (auth_areas()); Administrador, Pastor de campus y Ministro ven y asignan
 * en cualquier área de su campus (auth_es_finanzas()).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));

  const supabase = await createClient();
  let query = supabase
    .from("actividades_equipo")
    .select("*")
    .order("estado", { ascending: true })
    .order("fecha_limite", { ascending: true });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const ActividadSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  actividad: z.string().trim().min(1, "Falta describir la actividad.").max(500),
  asignado_nombre: z.string().trim().min(1, "Falta el nombre de quién la hace."),
  asignado_correo: z.string().trim().toLowerCase().email("Correo no válido."),
  fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, ActividadSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const { data, error } = await supabase
    .from("actividades_equipo")
    .insert({
      ...parsedBody.data,
      creado_por_correo: identidad.perfil.correo,
      creado_por_nombre: identidad.perfil.nombre,
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);

  // El correo se manda después de responder — así Resend lento/caído nunca
  // retrasa la confirmación en pantalla (la actividad ya quedó guardada).
  after(async () => {
    try {
      await avisarActividad({
        correo: parsedBody.data.asignado_correo,
        nombre: parsedBody.data.asignado_nombre,
        actividad: parsedBody.data.actividad,
        area: parsedBody.data.area,
        campus: parsedBody.data.campus,
        fechaLimite: fechaLegible(parsedBody.data.fecha_limite),
        asignadoPor: identidad.perfil.nombre,
      });
    } catch (eCorreo) {
      console.error("[actividades] error enviando aviso:", eCorreo);
    }
  });

  return ok(data, 201);
}
