import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ecoNota: notas internas por área/fecha/hora (PK = key, construida igual
 * que la de encuentros: campus|area|fecha|hora). */
const NotaSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREAS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  hora: z.string().optional(),
  nota: z.string().trim().max(2000).optional(),
});

function claveNota(a: z.infer<typeof NotaSchema>) {
  return [a.campus, a.area, a.fecha, a.hora ?? ""].join("|");
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

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, NotaSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error } = await supabase
    .from("notas")
    .upsert({
      key: claveNota(parsedBody.data),
      campus: parsedBody.data.campus,
      area: parsedBody.data.area,
      fecha: parsedBody.data.fecha,
      hora: parsedBody.data.hora,
      nota: parsedBody.data.nota,
      por: identidad?.perfil.correo ?? null,
      actualizado: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
