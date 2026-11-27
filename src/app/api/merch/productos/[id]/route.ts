import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import type { Database } from "@/lib/supabase/types";
import { z } from "zod";

type MerchProductoUpdate = Database["public"]["Tables"]["merch_productos"]["Update"];

const FOTO_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const EdicionSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre.").max(80).optional(),
  descripcion: z.string().trim().max(200).nullable().optional(),
  precio: z.number().int().min(0).max(100_000_000).optional(),
  activo: z.boolean().optional(),
  // Reemplaza la lista completa de fotos (agregar/quitar una se arma del
  // lado del cliente sobre la lista actual y se manda entera acá).
  fotos: z.array(z.string().regex(FOTO_REGEX).max(45_000)).max(6).optional(),
});

/** Editar nombre/precio/activo/fotos de un producto. El stock NO se toca
 * acá — siempre pasa por /movimiento para dejar registro en el ledger. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const parsedBody = await parseBody(req, EdicionSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const { fotos, ...resto } = parsedBody.data;
  const cambios: MerchProductoUpdate = { ...resto, actualizado_en: new Date().toISOString() };
  if (fotos !== undefined) {
    cambios.fotos = fotos;
    cambios.foto_url = fotos[0] ?? null;
  }

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("merch_productos")
    .update(cambios, { count: "exact" })
    .eq("id", Number(params.id))
    .select()
    .maybeSingle();
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el producto no existe.", 403);
  return ok(data);
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("merch_productos")
    .delete({ count: "exact" })
    .eq("id", Number(params.id));
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No tienes permiso, o el producto no existe.", 403);
  return ok({ id: Number(params.id) });
}
