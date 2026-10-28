import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/**
 * api_fechasEncLista / api_fechaEncGuardar. En Code.gs esto solo existe para
 * "Puerto Natales" (`CAMPUS_FECHAS_IRREGULARES`): a diferencia de Punta
 * Arenas (encuentro fijo todas las semanas), ahí el Pastor marca cuáles
 * domingos del mes sí tienen encuentro. Gate: Pastor o Admin app.
 */
function domingosDelMes(mes: string): string[] {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const f = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() === 0) out.push(f);
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
  const mesParam = searchParams.get("mes");
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hoyISO.slice(0, 7);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fechas_encuentro")
    .select("*")
    .eq("campus", "Puerto Natales");
  if (error) return fromSupabaseError(error);

  const mapa = new Map((data ?? []).map((r) => [r.fecha, r.activo]));
  const fechas = domingosDelMes(mes).map((f) => ({ fecha: f, activo: mapa.get(f) ?? false }));
  return ok({ mes, fechas });
}

const GuardarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  activo: z.boolean().default(true),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, GuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);

  const { data, error } = await supabase
    .from("fechas_encuentro")
    .upsert({
      ...parsedBody.data,
      campus: "Puerto Natales" as const,
      por: identidad?.perfil.correo ?? null,
      actualizado: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
