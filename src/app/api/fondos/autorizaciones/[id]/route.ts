import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { registrarBitacora } from "@/lib/bitacora";
import { identidadActuante } from "@/lib/identidad";
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
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  // El paso del Pastor queda a nombre de la identidad EFECTIVA (si hay una
  // "vista como X" activa y X es Pastor, resuelve como X); el paso final
  // de Admin app siempre queda a nombre del admin REAL (auth_es_admin_app()
  // no cambia con la impersonación — ver auth_id_efectivo()).
  const perfilPastor = identidad.perfil;
  const perfilAdmin = identidad.real;

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
      ? { estado: "Pendiente Admin", pastor: perfilPastor.nombre, pastor_en: cuando }
      : {
          estado: "Rechazada",
          pastor: perfilPastor.nombre,
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
    await registrarBitacora({
      actorCorreo: perfilPastor.correo,
      actorNombre: perfilPastor.nombre,
      accion: aprobar ? "fondos_reapertura_ok_pastor" : "fondos_reapertura_rechazada_pastor",
      entidad: "autorizaciones_fondos",
      entidadId: params.id,
      detalle: { campus: actual.campus, area: actual.area, mes: actual.mes },
    });
    return ok(data);
  }

  if (actual.estado === "Pendiente Admin") {
    const vence = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const cambios = aprobar
      ? { estado: "Aprobada", admin: perfilAdmin.nombre, admin_en: cuando, vence }
      : {
          estado: "Rechazada",
          admin: perfilAdmin.nombre,
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
    await registrarBitacora({
      actorCorreo: perfilAdmin.correo,
      actorNombre: perfilAdmin.nombre,
      accion: aprobar ? "fondos_reapertura_aprobada_admin" : "fondos_reapertura_rechazada_admin",
      entidad: "autorizaciones_fondos",
      entidadId: params.id,
      detalle: { campus: actual.campus, area: actual.area, mes: actual.mes },
    });
    return ok(data);
  }

  return fail("Esa solicitud ya fue resuelta.", 409);
}
