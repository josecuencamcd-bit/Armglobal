import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { ArgsSchema, CAMPUS, claveSesion } from "@/lib/sesiones";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("No autenticado.", 401);

    const { data: perfil, error: ePerfil } = await supabase
      .from("perfiles")
      .select("correo, nombre")
      .eq("id", user.id)
      .single<{ correo: string; nombre: string }>();
    if (ePerfil) throw ePerfil;

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

/** Lista las solicitudes visibles para el usuario (RLS: su propio campus). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("autorizaciones_encuentro")
    .select("*")
    .order("pedido", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
