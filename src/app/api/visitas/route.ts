import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoVisitas / api_ecoVisitaAdd. Gate: área Conexión, Pastor de campus/
 * alto, o Administrador (RLS visitas_select/visitas_insert). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));

  const supabase = await createClient();
  let query = supabase.from("visitas").select("*").order("creado_en", { ascending: false });
  if (campus) query = query.eq("campus", campus);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const VisitaSchema = z.object({
  campus: z.enum(CAMPUS),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
  telefono: z.string().trim().max(30).optional(),
  nota: z.string().trim().max(500).optional(),
  proximo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, VisitaSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error } = await supabase
    .from("visitas")
    .insert({
      ...parsedBody.data,
      estado: "Pendiente",
      creado_por: identidad?.perfil.nombre ?? null,
      creado_por_correo: identidad?.perfil.correo ?? null,
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
