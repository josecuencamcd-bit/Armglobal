import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/** api_ayudaEnviar: cualquier usuario puede mandar un mensaje de ayuda/soporte.
 * RLS: solo ve/crea con su propio correo, o Admin app ve todas. */
const AyudaSchema = z.object({
  mensaje: z.string().trim().min(1, "Falta el mensaje.").max(1000),
  tipo: z.string().trim().max(60).optional(),
  perfil: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, AyudaSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const perfil = identidad.perfil;

  const { data, error } = await supabase
    .from("ayuda")
    .insert({ ...parsedBody.data, correo: perfil.correo, nombre: perfil.nombre, estado: "Pendiente" })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ayuda").select("*").order("fecha", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
