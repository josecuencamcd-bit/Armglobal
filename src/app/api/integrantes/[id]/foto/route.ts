import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { esFin } from "@/lib/visibilidad-modulos";
import { z } from "zod";

/**
 * Foto de perfil de un integrante (distinta de perfiles.foto_url, que es
 * la del propio usuario con cuenta en la app) — mismo formato: data URL
 * base64 guardada directo en la columna, sin bucket de Storage.
 *
 * Permiso: lo mismo que ya deja VER el roster de un equipo en
 * GET /api/integrantes?area= (Finanzas/Pastor/Ministro/Administrador ven
 * todo su campus; un líder o quien sirve en esa área ve/edita la suya) —
 * cualquiera de esos puede ponerle o cambiarle la foto a un compañero,
 * no solo quien lo gestiona. Por eso usa el cliente admin para el
 * update (la policy integrantes_update solo deja escribir al líder/
 * Finanzas), con el chequeo de permiso hecho acá mismo.
 */
const FotoSchema = z.object({
  foto_url: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "La foto no es válida.")
    .max(45_000, "La foto es muy pesada. Prueba con otra."),
});

async function puedeVerEsteIntegrante(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: number
): Promise<{ ok: boolean; status?: number; mensaje?: string }> {
  const identidad = await identidadActuante(supabase);
  if (!identidad) return { ok: false, status: 401, mensaje: "No autenticado." };

  const admin = createAdminClient();
  const { data: integrante } = await admin.from("integrantes").select("area, campus").eq("id", id).maybeSingle();
  if (!integrante) return { ok: false, status: 404, mensaje: "El integrante no existe." };

  const { data: extra } = await admin.from("integrante_equipos_extra").select("area").eq("integrante_id", id);
  const areasDelIntegrante = [integrante.area, ...(extra ?? []).map((e) => e.area)];

  const autorizado =
    esFin(identidad.perfil) ||
    areasDelIntegrante.some((a) => identidad.perfil.areas.includes(a) || identidad.perfil.sirve.includes(a));
  if (!autorizado) return { ok: false, status: 403, mensaje: "No tienes permiso para ver este equipo." };
  return { ok: true };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = Number(params.id);
  const parsedBody = await parseBody(req, FotoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const permiso = await puedeVerEsteIntegrante(supabase, id);
  if (!permiso.ok) return fail(permiso.mensaje!, permiso.status);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrantes")
    .update({ foto_url: parsedBody.data.foto_url })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  return ok(data);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = Number(params.id);

  const supabase = await createClient();
  const permiso = await puedeVerEsteIntegrante(supabase, id);
  if (!permiso.ok) return fail(permiso.mensaje!, permiso.status);

  const admin = createAdminClient();
  const { data, error } = await admin.from("integrantes").update({ foto_url: null }).eq("id", id).select().maybeSingle();
  if (error) return fromSupabaseError(error);
  return ok(data);
}
