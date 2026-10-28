import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { z } from "zod";

/**
 * CRUD de "integrantes" (= hoja "Programa"). RLS decide quién ve/escribe
 * qué según campus + área (integrantes_select/integrantes_rw/integrantes_update):
 * Finanzas ve todo su campus; un líder/voluntario de área solo ve/edita la
 * suya; "auth_sirve()" además deja ver (no editar) integrantes del área a
 * la que uno mismo sirve.
 */
const IntegranteSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
  telefono: z.string().trim().max(30).optional(),
  correo: z.string().trim().email("Correo no válido.").optional().or(z.literal("")),
  nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  anos_iglesia: z.number().int().min(0).max(120).optional(),
  anos_servicio: z.number().int().min(0).max(120).optional(),
  rol_servicio: z.string().trim().max(60).optional(),
  profesion: z.string().trim().max(120).optional(),
  estado: z.string().trim().max(40).default("Activo"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));

  const supabase = await createClient();
  let query = supabase.from("integrantes").select("*").order("nombre", { ascending: true });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, IntegranteSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: perfil } = user
      ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
      : { data: null };

    const { data, error } = await supabase
      .from("integrantes")
      .insert({ ...parsedBody.data, creado_por: perfil?.correo ?? null })
      .select()
      .single();
    if (error) throw error;
    return ok(data, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
