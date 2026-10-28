import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoSolicitudes: lista de solicitudes de baja de un integrante. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));

  const supabase = await createClient();
  let query = supabase.from("solicitudes_baja").select("*").order("fecha", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

/** api_ecoSolBaja: un líder/voluntario pide dar de baja a un integrante de su área. */
const SolBajaSchema = z.object({
  integrante_id: z.number().int().positive(),
  campus: z.enum(CAMPUS),
  area: z.enum(AREAS),
  nombre: z.string().trim().max(120).optional(),
  motivo: z.string().trim().min(1, "Falta el motivo.").max(300),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, SolBajaSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error } = await supabase
    .from("solicitudes_baja")
    .insert({ ...parsedBody.data, estado: "Pendiente", solicitante: identidad?.perfil.correo ?? null })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
