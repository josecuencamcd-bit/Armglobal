import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { z } from "zod";

/**
 * Catálogo general de Merch (vitrina): cualquier persona del campus puede
 * listarlo (RLS merch_productos_select) — solo área "Merch" o Finanzas
 * puede crear/editar (RLS merch_productos_write).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  if (!campus) return fail("Falta el campus.", 400);
  const soloActivos = searchParams.get("activos") === "1";

  const supabase = await createClient();
  let query = supabase.from("merch_productos").select("*").eq("campus", campus).order("nombre");
  if (soloActivos) query = query.eq("activo", true);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const ProductoSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(80),
  precio: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  // Igual formato/tope que integrantes.foto_url y perfiles.foto_url.
  foto_url: z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).max(45_000).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, ProductoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const { data, error } = await supabase.from("merch_productos").insert(parsedBody.data).select().single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
