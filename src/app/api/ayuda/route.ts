import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const { data: perfil, error: ePerfil } = await supabase
    .from("perfiles")
    .select("correo, nombre")
    .eq("id", user.id)
    .single<{ correo: string; nombre: string }>();
  if (ePerfil) return fromSupabaseError(ePerfil);

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
