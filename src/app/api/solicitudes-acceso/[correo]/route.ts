import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/** Equivalente a api_accesoResolver. Gate: Admin app (RLS: solicitudes_acceso_resolver). */
const ResolverSchema = z.object({ aprobar: z.boolean() });

export async function PATCH(req: Request, context: { params: Promise<{ correo: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, ResolverSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
    : { data: null };

  const { data, error, count } = await supabase
    .from("solicitudes_acceso")
    .update(
      {
        estado: parsedBody.data.aprobar ? "Aprobada" : "Rechazada",
        resuelto_por: perfil?.correo ?? null,
        resuelto_en: new Date().toISOString(),
      },
      { count: "exact" }
    )
    .eq("correo", decodeURIComponent(params.correo))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o la solicitud no existe.", 403);
  return ok(data);
}
