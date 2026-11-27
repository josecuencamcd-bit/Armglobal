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

const FOTO_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const ProductoSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(80),
  descripcion: z.string().trim().max(200).optional(),
  precio: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  // Varias fotos por producto (hasta 6); cada una con el mismo formato/tope
  // que integrantes.foto_url y perfiles.foto_url. foto_url (legado, una sola
  // foto) se mantiene sincronizado con fotos[0] para lo que todavía lo lea.
  fotos: z.array(z.string().regex(FOTO_REGEX).max(45_000)).max(6).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, ProductoSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const { fotos, ...resto } = parsedBody.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("merch_productos")
    .insert({ ...resto, fotos: fotos ?? [], foto_url: fotos?.[0] ?? null })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
