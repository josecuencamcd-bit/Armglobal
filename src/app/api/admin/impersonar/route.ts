import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { registrarBitacora } from "@/lib/bitacora";
import { z } from "zod";

/**
 * "Ver la app como X" (api_verComo, nueva — no existía en Code.gs como
 * endpoint propio, pero reemplaza su "entrar al perfil de otro y ver en
 * vivo lo que hacía"). GET: estado actual (si hay impersonación activa,
 * quién es el target). POST: la inicia. DELETE: "Salir de la vista".
 * Solo puede tener efecto sobre la PROPIA fila (admin_id = auth.uid()) —
 * la policy impersonaciones_propia exige además el rol Admin app para
 * insertar, así que esto nunca sirve para "hacerse pasar" por nadie si
 * quien llama no es Admin app.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: imp } = await supabase
    .from("impersonaciones_activas")
    .select("target_id, target_correo, target_nombre, iniciada_en")
    .eq("admin_id", user.id)
    .maybeSingle();

  if (!imp) return ok({ activo: false });

  const { data: target } = await supabase.from("perfiles").select("*").eq("id", imp.target_id).maybeSingle();
  return ok({ activo: true, target, iniciada_en: imp.iniciada_en });
}

const IniciarSchema = z.object({ perfilId: z.string().uuid() });

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, IniciarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: admin } = await supabase.from("perfiles").select("correo, roles").eq("id", user.id).maybeSingle();
  if (!admin?.roles?.includes("Admin app")) return fail("Solo Admin app puede ver la app como otra persona.", 403);

  const { data: target } = await supabase.from("perfiles").select("id, correo, nombre").eq("id", parsedBody.data.perfilId).maybeSingle();
  if (!target) return fail("Ese perfil no existe.", 404);
  if (target.id === user.id) return fail("Ya eres tú.", 400);

  const { error } = await supabase.from("impersonaciones_activas").upsert({
    admin_id: user.id,
    admin_correo: admin.correo,
    target_id: target.id,
    target_correo: target.correo,
    target_nombre: target.nombre,
    iniciada_en: new Date().toISOString(),
  });
  if (error) return fromSupabaseError(error);

  await registrarBitacora({
    actorCorreo: admin.correo,
    actorNombre: null,
    accion: "impersonacion_iniciada",
    entidad: "perfiles",
    entidadId: target.id,
    detalle: { target_correo: target.correo, target_nombre: target.nombre },
  });

  return ok({ activo: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: imp } = await supabase
    .from("impersonaciones_activas")
    .select("admin_correo, target_correo, target_nombre")
    .eq("admin_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("impersonaciones_activas").delete().eq("admin_id", user.id);
  if (error) return fromSupabaseError(error);

  if (imp) {
    await registrarBitacora({
      actorCorreo: imp.admin_correo,
      actorNombre: null,
      accion: "impersonacion_terminada",
      entidad: "perfiles",
      detalle: { target_correo: imp.target_correo, target_nombre: imp.target_nombre },
    });
  }

  return ok({ activo: false });
}
