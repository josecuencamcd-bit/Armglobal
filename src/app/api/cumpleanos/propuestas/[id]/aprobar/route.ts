import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { cumpleEnviar } from "@/lib/cumpleanos";
import { minutosDelDia } from "@/lib/vigilantes";
import { hoy } from "@/lib/sesiones";

/** api_cumpleAprobar: Admin app aprueba el mensaje. Si es de hoy y ya son
 * las 8am o más, se manda al instante (igual que Code.gs); si no, queda
 * Aprobada para que el cron la envíe apenas corresponda. */
export async function PATCH(_req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("cumple_propuestas")
    .update({ estado: "Aprobada", resuelta_en: new Date().toISOString() }, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("Solo Admin app puede aprobar, o la propuesta no existe.", 403);
  if (!data) return fail("La propuesta no existe.", 404);

  if (data.fecha === hoy() && minutosDelDia() >= 8 * 60) {
    try {
      const admin = createAdminClient();
      const destinatarios = await cumpleEnviar(admin, data);
      return ok({ ...data, estado: "Enviada", enviado: true, destinatarios });
    } catch (e) {
      // queda Aprobada: el cron lo reintenta en la próxima pasada
      return ok({ ...data, enviado: false, error: e instanceof Error ? e.message : "No se pudo enviar." });
    }
  }
  return ok({ ...data, enviado: false });
}
