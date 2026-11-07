import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { registrarBitacora } from "@/lib/bitacora";
import { avisarAdmins } from "@/lib/email";
import { z } from "zod";

const ROLES_PASTOR = ["Pastor de campus", "Pastor", "Pastor principal"];

/**
 * Resuelve el paso que corresponda — mismo patrón de dos pasos que
 * /api/fondos/autorizaciones/[id], con una diferencia: acá Soporte (Admin
 * app) puede dar la aprobación final en cualquier momento, sin esperar a
 * que el Pastor haya dado su Ok primero (el Pastor solo puede resolver el
 * primer paso; el último paso de seguridad siempre lo da Soporte).
 * - "Pendiente Pastor": el Pastor del campus da el Ok (pasa a "Pendiente
 *   Admin") o rechaza. Admin app también puede resolverla directo acá.
 * - "Pendiente Admin": Admin app da la aprobación final (vence en 2h,
 *   igual que antes) o rechaza.
 */
const ResolverSchema = z.object({
  aprobar: z.boolean(),
  motivo_rechazo: z.string().trim().max(160).optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  // El paso de Pastor queda a nombre de la identidad efectiva (si hay una
  // "vista como X" activa); el paso final de Soporte siempre a nombre del
  // admin real — mismo criterio que /api/fondos/autorizaciones/[id].
  const perfilActuante = identidad.perfil;
  const perfilAdmin = identidad.real;
  const esAdminApp = perfilAdmin.roles.includes("Admin app");
  const esPastor = ROLES_PASTOR.some((r) => perfilActuante.roles.includes(r as never));

  const { data: actual, error: eActual } = await supabase
    .from("autorizaciones_encuentro")
    .select("*")
    .eq("id", Number(params.id))
    .maybeSingle();
  if (eActual) return fromSupabaseError(eActual);
  if (!actual) return fail("No encontré la solicitud.", 404);

  if (actual.estado !== "Pendiente Pastor" && actual.estado !== "Pendiente Admin") {
    return fail("Esa solicitud ya fue resuelta.", 409);
  }

  const cuando = new Date().toISOString();
  const { aprobar, motivo_rechazo } = parsedBody.data;

  // Soporte (Admin app) siempre puede dar el paso final, en cualquiera de
  // los dos estados pendientes — no necesita esperar al Pastor.
  if (esAdminApp) {
    const vence = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const cambios = aprobar
      ? { estado: "Autorizada", resuelto_por: perfilAdmin.correo, vence }
      : { estado: "Rechazada", resuelto_por: perfilAdmin.correo, rechazo: motivo_rechazo || "Soporte no aprobó." };
    const { data, error, count } = await supabase
      .from("autorizaciones_encuentro")
      .update(cambios, { count: "exact" })
      .eq("id", actual.id)
      .select()
      .maybeSingle();
    if (error) return fromSupabaseError(error);
    if (count === 0) return fail("No tienes permiso, o la solicitud no existe.", 403);
    await registrarBitacora({
      actorCorreo: perfilAdmin.correo,
      actorNombre: perfilAdmin.nombre,
      accion: aprobar ? "encuentro_reabierto" : "encuentro_reapertura_rechazada",
      entidad: "autorizaciones_encuentro",
      entidadId: params.id,
      detalle: { campus: data?.campus, encuentro: data?.encuentro, fecha: data?.fecha },
    });
    return ok(data);
  }

  // Pastor: solo puede dar el primer paso (Pendiente Pastor → Pendiente
  // Admin o Rechazada). Si ya pasó ese paso, falta Soporte — no hay nada
  // más para el Pastor acá.
  if (esPastor) {
    if (actual.estado !== "Pendiente Pastor") {
      return fail("Ya diste tu Ok en esta solicitud — ahora falta el paso final de Soporte.", 409);
    }
    const cambios = aprobar
      ? { estado: "Pendiente Admin", pastor: perfilActuante.nombre, pastor_en: cuando }
      : { estado: "Rechazada", pastor: perfilActuante.nombre, pastor_en: cuando, rechazo: motivo_rechazo || "El Pastor de campus no dio el Ok." };
    const { data, error, count } = await supabase
      .from("autorizaciones_encuentro")
      .update(cambios, { count: "exact" })
      .eq("id", actual.id)
      .select()
      .maybeSingle();
    if (error) return fromSupabaseError(error);
    if (count === 0) return fail("Solo el Pastor de ese campus da el Ok.", 403);
    await registrarBitacora({
      actorCorreo: perfilActuante.correo,
      actorNombre: perfilActuante.nombre,
      accion: aprobar ? "encuentro_reapertura_ok_pastor" : "encuentro_reapertura_rechazada_pastor",
      entidad: "autorizaciones_encuentro",
      entidadId: params.id,
      detalle: { campus: data?.campus, encuentro: data?.encuentro, fecha: data?.fecha },
    });

    if (aprobar) {
      try {
        const admin = createAdminClient();
        const { data: admins } = await admin.from("perfiles").select("correo").contains("roles", ["Admin app"]);
        await avisarAdmins({
          destinatarios: (admins ?? []).map((a) => a.correo).filter((c): c is string => !!c),
          asunto: `Falta tu paso final: ${data?.encuentro} · ${data?.campus}`,
          titulo: "El Pastor ya dio el Ok — falta tu aprobación",
          datos: [
            ["Encuentro", `${data?.encuentro} · ${data?.campus}`],
            ["Fecha", data?.fecha ?? ""],
            ["Pastor", perfilActuante.nombre],
          ],
          nota: "Apruébala en Soporte > Reabrir encuentros para que quede habilitada.",
        });
      } catch {
        // un correo que falla no debe tumbar la aprobación ya guardada
      }
    }

    return ok(data);
  }

  return fail("No tienes permiso para resolver esta solicitud.", 403);
}
