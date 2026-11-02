import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoNota/guardarNota_: nota interna del encuentro de un área en una
 * fecha (PK = key, igual que en Code.gs: campus|area|fecha — una sola nota
 * por área y día, sin componente de hora). */
const NotaSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREAS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  nota: z.string().trim().max(1000).optional(),
});

function claveNota(a: z.infer<typeof NotaSchema>) {
  return [a.campus, a.area, a.fecha].join("|");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));

  const supabase = await createClient();
  let query = supabase.from("notas").select("*").order("fecha", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

/** soloLider_: solo el líder del área (igual que Code.gs). */
function esLiderDeArea(roles: string[], areas: string[], campusPerfil: string | null, campus: string, area: string) {
  return roles.includes("Líder") && areas.includes(area) && (campusPerfil == null || campusPerfil === campus);
}

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, NotaSchema);
  if ("error" in parsedBody) return parsedBody.error;
  const { campus, area, fecha, nota } = parsedBody.data;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const areas = (perfil.areas as string[] | null) ?? [];
  if (!esLiderDeArea(roles, areas, perfil.campus ?? null, campus, area)) {
    return fail("Esta acción es solo del líder del área.", 403);
  }

  const key = claveNota(parsedBody.data);
  const { data: existente, error: eExistente } = await supabase.from("notas").select("finalizado").eq("key", key).maybeSingle();
  if (eExistente) return fromSupabaseError(eExistente);
  if (existente?.finalizado) return fail("Este encuentro ya fue finalizado.", 409);

  const { data, error } = await supabase
    .from("notas")
    .upsert({
      key,
      campus,
      area,
      fecha,
      nota,
      finalizado: false,
      por: perfil.correo,
      hora: new Date().toTimeString().slice(0, 8),
      actualizado: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
