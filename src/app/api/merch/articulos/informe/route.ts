import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";

/**
 * Informe de ventas de Merch: stock actual + movimientos de tipo "Venta"
 * (y "Entrega", porque también sale del inventario real) en el rango de
 * fechas pedido, agregados por tipo × talla. merch_movimientos no guarda
 * tipo/talla directo (solo articulo_id), así que se arma el mapa acá en
 * vez de pedirle un JOIN+GROUP BY a Postgrest.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  if (!campus) return fail("Falta el campus.", 400);
  const desde = searchParams.get("desde") || undefined;
  const hasta = searchParams.get("hasta") || undefined;

  const supabase = await createClient();

  const { data: articulos, error: errArt } = await supabase
    .from("merch_articulos")
    .select("*")
    .eq("campus", campus);
  if (errArt) return fromSupabaseError(errArt);

  const idPorArticulo = new Map((articulos ?? []).map((a) => [a.id, a]));

  let movQuery = supabase
    .from("merch_movimientos")
    .select("*")
    .eq("campus", campus)
    .in("tipo_mov", ["Venta", "Entrega"])
    .order("fecha", { ascending: false });
  if (desde) movQuery = movQuery.gte("fecha", desde);
  if (hasta) movQuery = movQuery.lte("fecha", hasta);

  const { data: movimientos, error: errMov } = await movQuery;
  if (errMov) return fromSupabaseError(errMov);

  const resumen = new Map<string, { tipo: string; talla: string; cantidad: number; movimientos: number }>();
  for (const m of movimientos ?? []) {
    const art = idPorArticulo.get(m.articulo_id);
    if (!art) continue;
    const clave = `${art.tipo}__${art.talla}`;
    const actual = resumen.get(clave) ?? { tipo: art.tipo, talla: art.talla, cantidad: 0, movimientos: 0 };
    actual.cantidad += m.cantidad;
    actual.movimientos += 1;
    resumen.set(clave, actual);
  }

  const detalle = (movimientos ?? []).map((m) => ({
    ...m,
    tipo: idPorArticulo.get(m.articulo_id)?.tipo ?? null,
    talla: idPorArticulo.get(m.articulo_id)?.talla ?? null,
  }));

  return ok({
    stock: articulos ?? [],
    ventas: [...resumen.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.talla.localeCompare(b.talla)),
    totalVendido: (movimientos ?? []).reduce((acc, m) => acc + m.cantidad, 0),
    movimientos: detalle,
    desde: desde ?? null,
    hasta: hasta ?? null,
  });
}
