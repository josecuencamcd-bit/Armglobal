import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { avisarResultadoAcceso } from "@/lib/email";
import { z } from "zod";

/**
 * Equivalente a api_accesoResolver. Gate: Admin app (RLS: solicitudes_acceso_resolver).
 *
 * Aprobar solo desbloquea la cuenta (ya existe, bloqueada, desde que se
 * pidió el acceso — ver POST de /api/solicitudes-acceso). Asignar rol/área/
 * campus es un segundo paso del admin con /api/perfiles/[id] (api_perfilGuardar),
 * igual que para cualquier perfil ya existente. Rechazar borra la cuenta
 * entera (auth + perfil): a un correo rechazado no debe quedarle ningún
 * acceso, ni siquiera bloqueado.
 */
const ResolverSchema = z.object({ aprobar: z.boolean() });

export async function PATCH(req: Request, context: { params: Promise<{ correo: string }> }
) {
  const params = await context.params;
  const correo = decodeURIComponent(params.correo).toLowerCase();
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfilAdmin } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const { data, error, count } = await supabase
    .from("solicitudes_acceso")
    .update(
      {
        estado: parsedBody.data.aprobar ? "Aprobada" : "Rechazada",
        resuelto_por: perfilAdmin?.correo ?? null,
        resuelto_en: new Date().toISOString(),
      },
      { count: "exact" }
    )
    .eq("correo", correo)
    .eq("estado", "Pendiente")
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la solicitud ya no está pendiente.", 403);

  const admin = createAdminClient();
  const nombre = data?.nombre ?? "";
  if (parsedBody.data.aprobar) {
    const { error: errPerfil } = await admin.from("perfiles").update({ bloqueado: false }).eq("correo", correo);
    if (errPerfil) return fromSupabaseError(errPerfil);
  } else {
    const { data: perfil } = await admin.from("perfiles").select("id").eq("correo", correo).maybeSingle();
    if (perfil) {
      await admin.from("perfiles").delete().eq("id", perfil.id);
      await admin.auth.admin.deleteUser(perfil.id);
    }
  }

  try {
    await avisarResultadoAcceso(correo, nombre, parsedBody.data.aprobar);
  } catch {
    // no revertimos la resolución por un fallo de envío
  }

  return ok(data);
}
