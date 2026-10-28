import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { z } from "zod";

/** api_turnoLista / api_turnoGuardar. PK compuesta (semana, campus).
 * Solo Pastores escriben (RLS turnos_rw/turnos_update); cualquiera de su
 * campus puede leer. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));

  const supabase = await createClient();
  let query = supabase.from("turnos").select("*").order("semana", { ascending: false });
  if (campus) query = query.eq("campus", campus);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const GuardarSchema = z.object({
  semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Semana no válida."),
  campus: z.enum(CAMPUS),
  nombres: z.array(z.string()).optional(),
  correos: z.array(z.string().email()).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, GuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const { data, error } = await supabase
    .from("turnos")
    .upsert({
      ...parsedBody.data,
      por: perfil?.correo ?? null,
      actualizado: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
