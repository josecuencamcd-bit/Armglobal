import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { ArgsSchema, AporteSchema } from "@/lib/sesiones";
import { asegurarSesion } from "@/lib/sesiones-db";

function argsDeKey(key: string) {
  const [campus, encuentro, evento, fecha] = key.split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  return parsed.success ? parsed.data : null;
}

/** GET: lista los aportes del encuentro (equivalente a leerSesion_().aportes). */
export async function GET(_req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const key = decodeURIComponent(params.key);
  if (!argsDeKey(key)) return fail("Encuentro no válido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aportes")
    .select("*")
    .eq("sesion_key", key)
    .order("creado_en", { ascending: true });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

/**
 * POST: equivalente a api_addAporte. Code.gs aceptaba un id ya generado por
 * el cliente si parecía uno de los suyos (string alfanumérico 6-24) para
 * soportar reintentos idempotentes; si no, generaba uno nuevo. Replicamos
 * ese mismo criterio con un slice de randomUUID.
 */
export async function POST(req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const key = decodeURIComponent(params.key);
  const args = argsDeKey(key);
  if (!args) return fail("Encuentro no válido.");

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return fail("Body JSON inválido.");
  }
  const idCrudo = (bodyJson as { id?: unknown } | null)?.id;
  const id =
    typeof idCrudo === "string" && /^[a-z0-9]{6,24}$/.test(idCrudo)
      ? idCrudo
      : crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const parsedBody = AporteSchema.safeParse(bodyJson);
  if (!parsedBody.success) {
    const primero = parsedBody.error.issues[0];
    return fail(`${primero.path.join(".")}: ${primero.message}`);
  }

  const supabase = await createClient();
  try {
    await asegurarSesion(supabase, args);
    const { data, error } = await supabase
      .from("aportes")
      .insert({
        id,
        sesion_key: key,
        campus: args.campus,
        encuentro: args.encuentro,
        evento: args.evento || null,
        fecha: args.fecha,
        nombre: parsedBody.data.nombre,
        monto: parsedBody.data.monto,
        categoria: parsedBody.data.categoria,
        metodo: parsedBody.data.metodo,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
