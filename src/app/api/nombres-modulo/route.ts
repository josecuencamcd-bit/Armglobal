import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** Equivalente a api_nombresModulo / api_nombreModuloGuardar: nombres
 * personalizados para los módulos de la app (ej. renombrar "Equipos" a
 * "Mi Ministerio"). Lectura abierta a todos, escritura solo Admin app. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("nombres_modulo").select("*");
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const GuardarSchema = z.object({
  clave: z.string().trim().min(1).max(60),
  nombre: z.string().trim().min(1).max(60),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, GuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  // Gate: solo Admin app (RLS nombres_modulo_admin, real-identity-only) —
  // se atribuye al admin REAL, igual que perfiles/[id] y ayuda/[id].
  const identidad = await identidadActuante(supabase);

  const { data, error } = await supabase
    .from("nombres_modulo")
    .upsert({ ...parsedBody.data, por: identidad?.real.correo ?? null, actualizado: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    if ((error as { code?: string }).code === "42501" || /row-level security/i.test(error.message)) {
      return fail("Solo Admin app puede renombrar módulos.", 403);
    }
    return fromSupabaseError(error);
  }
  return ok(data, 201);
}
