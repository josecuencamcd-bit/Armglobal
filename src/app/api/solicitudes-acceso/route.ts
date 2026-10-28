import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Equivalente a api_solicitarAcceso (anónimo, antes de tener cuenta) y
 * api_accesos (lista para Admin app). PK real es `correo` (no hay id).
 */
const SolicitarSchema = z.object({
  correo: z.string().trim().email("Correo no válido."),
  nombre: z.string().trim().max(120).optional(),
  nota: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, SolicitarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes_acceso")
    .insert({ ...parsedBody.data, estado: "Pendiente" })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}

/** Gate: Admin app (RLS: solicitudes_acceso_admin). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes_acceso")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
