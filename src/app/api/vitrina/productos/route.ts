import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";

/**
 * Vitrina pública del catálogo de Merch: link que José comparte con gente
 * sin cuenta en la app (whatsapp, redes) para que vea qué hay disponible.
 * Sin sesión no hay auth.uid() y RLS no deja pasar nada, así que esta ruta
 * usa el cliente admin (service_role) para leer SOLO lo que corresponde
 * mostrar en público: productos activos (nombre/descripción/precio/foto/
 * stock, nunca ids internos de otras tablas) y los datos de transferencia
 * del campus, si el líder los cargó.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  if (!campus) return fail("Falta el campus.", 400);

  const admin = createAdminClient();
  const [{ data: productos, error: errProd }, { data: config }] = await Promise.all([
    admin
      .from("merch_productos")
      .select("id, nombre, descripcion, precio, foto_url, fotos, stock")
      .eq("campus", campus)
      .eq("activo", true)
      .order("nombre"),
    admin.from("merch_config").select("datos_transferencia").eq("campus", campus).maybeSingle(),
  ]);
  if (errProd) return fail(errProd.message, 400);

  return ok({ productos: productos ?? [], datosTransferencia: config?.datos_transferencia ?? null });
}
