import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/** Unifica las 7 hojas espejo de Fichas/Técnica de Code.gs vía `servicio` +
 * `tipo`. Lectura abierta; escritura por área (o Finanzas, o Administrador
 * para area="Administración" — ver fichas_servicio_rw/update). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const servicio = searchParams.get("servicio");
  const tipo = searchParams.get("tipo");
  const fecha = searchParams.get("fecha");

  const supabase = await createClient();
  let query = supabase.from("fichas_servicio").select("*").order("fecha", { ascending: false });
  if (servicio) query = query.eq("servicio", servicio);
  if (tipo) query = query.eq("tipo", tipo);
  if (fecha) query = query.eq("fecha", fecha);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const FichaSchema = z.object({
  servicio: z.string().trim().min(1).max(60),
  tipo: z.string().trim().min(1).max(40),
  area: z.string().trim().min(1).max(60),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  puesto: z.string().trim().min(1).max(60),
  nombre: z.string().trim().max(120).optional(),
  encargado: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, FichaSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fichas_servicio")
    .insert({ ...parsedBody.data, actualizado: new Date().toISOString() })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
