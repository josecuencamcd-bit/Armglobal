import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { z } from "zod";

/** api_ecoAsistencia: historial de seguimiento de un integrante. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrante_seguimiento")
    .select("*")
    .eq("integrante_id", Number(params.id))
    .order("fecha", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

/** api_ecoProgramar: agenda una próxima marca de seguimiento. */
const ProgramarSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREAS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  nombre: z.string().trim().max(120).optional(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ProgramarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrante_seguimiento")
    .insert({ ...parsedBody.data, integrante_id: Number(params.id), estado: "Pendiente" })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
