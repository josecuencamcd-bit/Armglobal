import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";

/** api_ecoEquipoStats: conteo de integrantes activos por área (RLS ya filtra
 * a lo que el usuario puede ver, igual que en Code.gs las stats nunca
 * salían del alcance del usuario). Se agrega en JS porque el cliente de
 * sesión no corre SQL crudo (eso iría contra RLS). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));

  const supabase = await createClient();
  let query = supabase.from("integrantes").select("area, estado");
  if (campus) query = query.eq("campus", campus);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);

  const stats: Record<string, { activos: number; total: number }> = {};
  for (const fila of data ?? []) {
    const s = (stats[fila.area] ??= { activos: 0, total: 0 });
    s.total += 1;
    if (fila.estado === "Activo") s.activos += 1;
  }
  return ok(stats);
}
