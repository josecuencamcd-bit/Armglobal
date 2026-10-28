import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { z } from "zod";

/** "Campus" no es un area_t real: significa "finanzas de todo el campus",
 * reservado a Pastores (ver migración fix_autorizaciones_fondos_area_campus). */
const AREA_O_CAMPUS = [...AREAS, "Campus"] as const;

/**
 * api_fonAutPedir / api_fonAutLista: a diferencia de /api/autorizaciones
 * (1 solo paso, Admin app), reabrir un mes de fondos cerrado es de DOS
 * pasos: primero el Pastor de campus da el "Ok" (estado "Pendiente Pastor"
 * → "Pendiente Admin"), luego Admin app da la aprobación final
 * ("Pendiente Admin" → "Aprobada", válida por 24h — HORAS_PERMISO_ en
 * Code.gs). Ver /api/fondos/autorizaciones/[id] para el resolver de cada paso.
 */
const PedirSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREA_O_CAMPUS),
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mes no válido."),
  motivo: z.string().trim().min(8, "Cuenta con claridad qué necesitas corregir y por qué.").max(300),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, PedirSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo, nombre").eq("id", user.id).single<{ correo: string; nombre: string }>()
    : { data: null };

  const { data, error } = await supabase
    .from("autorizaciones_fondos")
    .insert({
      ...parsedBody.data,
      solicitante: perfil?.nombre ?? null,
      correo: perfil?.correo ?? null,
      estado: "Pendiente Pastor",
      pedido: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("autorizaciones_fondos")
    .select("*")
    .order("pedido", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
