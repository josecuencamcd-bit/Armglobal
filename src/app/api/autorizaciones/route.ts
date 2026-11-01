import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { ArgsSchema, CAMPUS, claveSesion } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/**
 * Equivalente a api_autPedir(): un usuario de Finanzas pide autorización
 * para reabrir un encuentro ya finalizado. La policy autorizaciones_encuentro_insert
 * exige auth_es_finanzas() + que `correo` sea el propio (lo resolvemos acá
 * leyendo perfiles, igual que Code.gs usaba Session.getActiveUser()).
 */
const PedirSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  encuentro: z.string(),
  evento: z.string().optional().default(""),
  fecha: z.string(),
  motivo: z.string().trim().min(1, "Falta el motivo.").max(300),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, PedirSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const args = ArgsSchema.safeParse(parsedBody.data);
  if (!args.success) return fail("Encuentro no válido.");

  const supabase = await createClient();
  try {
    const identidad = await identidadActuante(supabase);
    if (!identidad) return fail("No autenticado.", 401);
    const perfil = identidad.perfil;

    const { data, error } = await supabase
      .from("autorizaciones_encuentro")
      .insert({
        correo: perfil.correo,
        nombre: perfil.nombre,
        sesion_key: claveSesion(args.data),
        campus: args.data.campus,
        encuentro: args.data.encuentro,
        fecha: args.data.fecha,
        motivo: parsedBody.data.motivo,
        estado: "Pendiente",
        pedido: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}

/**
 * Lista las solicitudes visibles para el usuario (RLS: su propio campus).
 * `?sesion_key=` filtra por un encuentro puntual — antes lo hacía el
 * cliente trayendo TODAS las autorizaciones del campus y filtrando en
 * memoria (encuentros/[key]/page.tsx), igual que api_autEstado ya hacía
 * server-side en Code.gs.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sesionKey = searchParams.get("sesion_key");

  const supabase = await createClient();
  let query = supabase.from("autorizaciones_encuentro").select("*").order("pedido", { ascending: false });
  if (sesionKey) query = query.eq("sesion_key", sesionKey);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
