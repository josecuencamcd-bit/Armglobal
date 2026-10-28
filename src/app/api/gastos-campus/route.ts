import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { z } from "zod";

/** api_finSemana / api_finInforme / api_finGasto: gastos de campus (no de
 * un área específica) — mismo patrón que /api/fondos pero sin `area`. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));

  const supabase = await createClient();
  let query = supabase.from("gastos_campus").select("*").order("fecha", { ascending: false });
  if (campus) query = query.eq("campus", campus);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const GastoSchema = z.object({
  campus: z.enum(CAMPUS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  item: z.string().trim().min(1, "Falta el ítem.").max(120),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  comercio: z.string().trim().max(120).optional(),
  boleta: z.string().trim().max(60).optional(),
  descripcion: z.string().trim().max(300).optional(),
  motivo: z.string().trim().max(300).optional(),
});

/** api_finGasto: registra un gasto de campus. */
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
