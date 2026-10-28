import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * api_fonAutResolver: resuelve el paso que corresponda según `estado`.
 * - "Pendiente Pastor": el Pastor de campus da el Ok (pasa a "Pendiente
 *   Admin") o rechaza. RLS (autorizaciones_fondos_resolver) exige
 *   auth_es_finanzas() — Code.gs además exige ser Pastor DE ESE campus
 *   específicamente; dejamos que la UI lo filtre por ahora (ver nota en
 *   mapeo-api-routes.md: no hay un auth_es_pastor_de_campus(c) todavía).
 * - "Pendiente Admin": Admin app da la aprobación final (24h de validez,
 *   HORAS_PERMISO_ en Code.gs) o rechaza.
 * - cualquier otro estado: ya fue resuelta.
 */
const ResolverSchema = z.object({
  aprobar: z.boolean(),
  motivo_rechazo: z.string().trim().max(160).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: perfil, error: ePerfil } = await supabase
    .from("perfiles")
    .select("correo, nombre")
    .eq("id", user.id)
    .single<{ correo: string; nombre: string }>();
  if (ePerfil) return fromSupabaseError(ePerfil);

  const { data: actual, error: eActual } = await supabase
    .from("autorizaciones_fondos")
    .select("*")
    .eq("id", Number(params.id))
    .maybeSingle();
  if (eActual) return fromSupabaseError(eActual);
  if (!actual) return fail("No encontré la solicitud.", 404);

  const cuando = new Date().toISOString();
  const { aprobar, motivo_rechazo } = parsedBody.data;

  if (actual.estado === "Pendiente Pastor") {
    const cambios = aprobar
      ? { estado: "Pendiente Admin", pastor: perfil.nombre, pastor_en: cuando }
      : {
          estado: "Rechazada",
          pastor: perfil.nombre,
          pastor_en: cuando,
          rechazo: motivo_rechazo || "El Pastor de campus no dio el Ok.",
        };
    const { data, error, count } = await supabase
      .from("autorizaciones_fondos")
      .update(cambios, { count: "exact" })
      .eq("id", actual.id)
      .select()
      .maybeSingle();
    if (error) return fromSupabaseError(error);
    if (count === 0) return fail("Solo el Pastor de campus da el Ok.", 403);
    return ok(data);
  }

  if (actual.estado === "Pendiente Admin") {
    const vence = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const cambios = aprobar
      ? { estado: "Aprobada", admin: perfil.nombre, admin_en: cuando, vence }
      : {
          estado: "Rechazada",
          admin: perfil.nombre,
          admin_en: cuando,
          rechazo: motivo_rechazo || "El administrador no aprobó.",
        };
    const { data, error, count } = await supabase
      .from("autorizaciones_fondos")
      .update(cambios, { count: "exact" })
      .eq("id", actual.id)
      .select()
      .maybeSingle();
    if (error) return fromSupabaseError(error);
    if (count === 0) return fail("La aprobación final la da Admin app.", 403);
    return ok(data);
  }

  return fail("Esa solicitud ya fue resuelta.", 409);
}
