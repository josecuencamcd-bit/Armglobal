import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { registrarBitacora } from "@/lib/bitacora";
import { z } from "zod";

/**
 * Equivalente a api_autResolver(): solo Admin app (RLS: auth_es_admin_app())
 * puede aprobar o rechazar. Al aprobar, vence = ahora + 2 horas — mismo
 * plazo que Code.gs, después del cual auth_autorizado() deja de valer.
 */
const ResolverSchema = z.object({
  aprobar: z.boolean(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("No autenticado.", 401);

    const { data: perfil, error: ePerfil } = await supabase
      .from("perfiles")
      .select("correo")
      .eq("id", user.id)
      .single();
    if (ePerfil) throw ePerfil;

    const vence = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { data, error, count } = await supabase
      .from("autorizaciones_encuentro")
      .update(
        {
          estado: parsedBody.data.aprobar ? "Autorizada" : "Rechazada",
          resuelto_por: perfil.correo,
          vence: parsedBody.data.aprobar ? vence : null,
        },
        { count: "exact" }
      )
      .eq("id", Number(params.id))
      .select()
      .maybeSingle();
    if (error) throw error;
    if (count === 0) return fail("No tienes permiso, o la solicitud no existe.", 403);

    await registrarBitacora({
      actorCorreo: perfil.correo,
      accion: parsedBody.data.aprobar ? "encuentro_reabierto" : "encuentro_reapertura_rechazada",
      entidad: "autorizaciones_encuentro",
      entidadId: params.id,
      detalle: { campus: data?.campus, encuentro: data?.encuentro, fecha: data?.fecha },
    });

    return ok(data);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
