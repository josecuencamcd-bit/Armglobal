import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/**
 * Equivalente a api_yo / api_miPerfil / api_miPerfilGuardar. El login/registro
 * propio de Code.gs (api_login, api_registrar, api_olvide, api_restablecer)
 * se reemplaza enteramente por Supabase Auth en el cliente
 * (supabase.auth.signInWithPassword / signUp / resetPasswordForEmail) — no
 * necesitan ruta propia.
 *
 * Nota de seguridad: aunque la policy `perfiles_update_propio` es a nivel de
 * fila, un trigger (`perfiles_proteger_columnas_sensibles`) impide que un
 * usuario cambie sus propios roles/areas/sirve/bloqueado/campus/modulos_*
 * aunque el body incluya esos campos — solo Admin app puede tocarlos
 * (vía /api/perfiles/[id], ver api_perfilGuardar).
 */
/**
 * api_fotoGuardar en Code.gs no sube a Drive: guarda la data URL (jpeg/png/
 * webp en base64, tope 45000 caracteres) directo en la celda — acá igual,
 * directo en `foto_url`, sin pasar por el bucket de Storage.
 */
const MiPerfilSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    telefono: z.string().trim().max(30).optional(),
    nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    foto_url: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "La foto no es válida.")
      .max(45_000, "La foto es muy pesada. Prueba con otra.")
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar." });

export async function GET() {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  // "Mi perfil" durante una "vista como X" es el perfil de X (modo prueba:
  // se puede usar todo, igual que en la app vieja) — ya viene resuelto.
  return ok(identidad.perfil);
}

export async function PATCH(req: Request) {
  const parsedBody = await parseBody(req, MiPerfilSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  // Si hay una "vista como X" activa, se edita el perfil de X (la policy
  // perfiles_update_admin_app igual lo permite porque el admin REAL sigue
  // siendo Admin app) — igual que la app vieja. correo/clave no están en
  // MiPerfilSchema, así que nunca se pueden tocar desde acá.
  const { data, error } = await supabase
    .from("perfiles")
    .update({ ...parsedBody.data, actualizado_en: new Date().toISOString() })
    .eq("id", identidad.perfil.id)
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data);
}
