import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

/** api_ecoCumples: cumpleaños próximos de integrantes del campus/área del
 * usuario (RLS de `integrantes` decide qué filas ve). Se filtra en JS porque
 * `nacimiento` guarda año real, no solo día/mes, y Postgres no tiene un
 * índice funcional para "próximos N días" sin una función dedicada. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("integrantes")
    .select("id, nombre, campus, area, nacimiento")
    .eq("estado", "Activo")
    .not("nacimiento", "is", null);
  if (error) return fromSupabaseError(error);

  const hoy = new Date();
  const enDias = (fecha: string) => {
    const n = new Date(fecha);
    const prox = new Date(hoy.getFullYear(), n.getMonth(), n.getDate());
    if (prox < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
      prox.setFullYear(hoy.getFullYear() + 1);
    }
    return Math.round((prox.getTime() - hoy.getTime()) / 86_400_000);
  };

  const proximos = (data ?? [])
    .map((i) => ({ ...i, en_dias: enDias(i.nacimiento as string) }))
    .filter((i) => i.en_dias <= 30)
    .sort((a, b) => a.en_dias - b.en_dias);

  return ok(proximos);
}
