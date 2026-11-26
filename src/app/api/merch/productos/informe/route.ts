import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";

/**
 * Informe del catálogo general de Merch: stock actual + ventas (ingresos,
 * unidades, más vendido) en el rango de fechas pedido. precio_unitario/monto
 * ya quedaron congelados al momento de cada venta (ver
 * merch_producto_registrar_movimiento), así que el ingreso del informe no
 * cambia aunque después se edite el precio del producto.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  if (!campus) return fail("Falta el campus.", 400);
  const desde = searchParams.get("desde") || undefined;
  const hasta = searchParams.get("hasta") || undefined;

  const supabase = await createClient();

  const { data: productos, error: errProd } = await supabase
    .from("merch_productos")
    .select("*")
    .eq("campus", campus);
  if (errProd) return fromSupabaseError(errProd);

  const nombrePorId = new Map((productos ?? []).map((p) => [p.id, p.nombre]));

  let movQuery = supabase
    .from("merch_producto_movimientos")
    .select("*")
    .eq("campus", campus)
    .eq("tipo_mov", "Venta")
    .order("fecha", { ascending: false });
  if (desde) movQuery = movQuery.gte("fecha", desde);
  if (hasta) movQuery = movQuery.lte("fecha", hasta);

  const { data: ventas, error: errMov } = await movQuery;
  if (errMov) return fromSupabaseError(errMov);

  const porProducto = new Map<number, { producto_id: number; nombre: string; unidades: number; ingresos: number; ventas: number }>();
  let ingresosTotales = 0;
  let unidadesTotales = 0;
  for (const v of ventas ?? []) {
    ingresosTotales += v.monto ?? 0;
    unidadesTotales += v.cantidad;
    const actual = porProducto.get(v.producto_id) ?? {
      producto_id: v.producto_id,
      nombre: nombrePorId.get(v.producto_id) ?? "(producto eliminado)",
      unidades: 0,
      ingresos: 0,
      ventas: 0,
    };
    actual.unidades += v.cantidad;
    actual.ingresos += v.monto ?? 0;
    actual.ventas += 1;
    porProducto.set(v.producto_id, actual);
  }

  const detalle = (ventas ?? []).map((v) => ({ ...v, nombre: nombrePorId.get(v.producto_id) ?? "(producto eliminado)" }));

  return ok({
    stock: productos ?? [],
    masVendidos: [...porProducto.values()].sort((a, b) => b.unidades - a.unidades),
    ingresosTotales,
    unidadesTotales,
    movimientos: detalle,
    desde: desde ?? null,
    hasta: hasta ?? null,
  });
}
