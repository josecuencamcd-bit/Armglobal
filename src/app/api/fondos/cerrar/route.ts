import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { z } from "zod";

/** api_fonCerrar: cierra el mes de un área (deja de poder registrar/anular
 * movimientos de ese mes salvo autorización — igual patrón que Encuentros). */
/** "Campus" no es un área de equipo (no está en AREAS/area_t) — es el
 * fondo/informe a nivel de campus (Finanzas), que usa la misma tabla
 * `cierres_mes` (ver FONDOS_CIERRE en vigilantes.ts). */
const AREA_O_CAMPUS = [...AREAS, "Campus"] as const;
const CerrarSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREA_O_CAMPUS),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido."),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, CerrarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const { data, error } = await supabase
    .from("cierres_mes")
    .insert({ ...parsedBody.data, automatico: false, por: perfil?.correo ?? null })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));

  const supabase = await createClient();
  let query = supabase.from("cierres_mes").select("*").order("mes", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
