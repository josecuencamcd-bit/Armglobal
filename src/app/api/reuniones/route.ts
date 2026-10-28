import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/** api_reuLista / api_reuCrear. RLS (reuniones_propias): cada usuario solo
 * ve/crea/edita SUS propias reuniones (correo = el suyo). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reuniones")
    .select("*")
    .order("fecha", { ascending: true });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const ReunionSchema = z.object({
  tipo: z.string().trim().min(1).max(60),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  hora: z.string().optional(),
  titulo: z.string().trim().max(120).optional(),
  lugar: z.string().trim().max(200).optional(),
  invitados: z.string().trim().max(1000).optional(),
  notas: z.string().trim().max(1000).optional(),
  duracion: z.number().int().positive().optional(),
  evento: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, ReunionSchema);
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
    .from("reuniones")
    .insert({ ...parsedBody.data, correo: perfil.correo, organizador: perfil.nombre, estado: "Programada" })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
