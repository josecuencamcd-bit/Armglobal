import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, GASTOS_ITEMS } from "@/lib/sesiones";
import { z } from "zod";

/**
 * api_finSemana / api_finInforme / api_finGasto: finanzas de campus (no de
 * un área específica). api_finInforme en Code.gs junta esta tabla CON los
 * aportes extraordinarios de campus (que viven en fondos_equipo, area=
 * 'Campus' — ver /api/fondos) para armar el informe mensual completo; acá
 * replicamos esa unión en la respuesta en vez de solo leer gastos_campus.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));

  const supabase = await createClient();
  let gastosQuery = supabase.from("gastos_campus").select("*").order("fecha", { ascending: false });
  if (campus) gastosQuery = gastosQuery.eq("campus", campus);

  let aportesQuery = supabase
    .from("fondos_equipo")
    .select("*")
    .eq("area", "Campus")
    .order("fecha", { ascending: false });
  if (campus) aportesQuery = aportesQuery.eq("campus", campus);

  const [{ data: gastos, error: errG }, { data: aportes, error: errA }] = await Promise.all([
    gastosQuery,
    aportesQuery,
  ]);
  if (errG) return fromSupabaseError(errG);
  if (errA) return fromSupabaseError(errA);

  return ok({ gastos: gastos ?? [], aportes: aportes ?? [] });
}

const GastoSchema = z.object({
  campus: z.enum(CAMPUS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  item: z.enum(GASTOS_ITEMS, { error: () => "Elige el tipo de gasto." }),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  comercio: z.string().trim().max(120).optional(),
  boleta: z.string().trim().max(60).optional(),
  descripcion: z.string().trim().min(5, "Escribe una breve descripción del gasto.").max(300),
  foto_url: z.string().url().optional(),
  motivo: z.string().trim().max(300).optional(),
});

/** api_finGasto: registra un gasto de campus. Gate: solo Pastor (RLS gastos_campus_insert). */
export async function POST(req: Request) {
  const parsedBody = await parseBody(req, GastoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const diasDesdeFecha = Math.floor(
    (Date.now() - new Date(`${parsedBody.data.fecha}T00:00:00Z`).getTime()) / 86_400_000
  );

  const { data, error } = await supabase
    .from("gastos_campus")
    .insert({ ...parsedBody.data, estado: "Activo", por: perfil?.correo ?? null, tardio: diasDesdeFecha > 7 })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
