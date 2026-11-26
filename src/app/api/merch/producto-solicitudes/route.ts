import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { subirFotoJpeg } from "@/lib/fotos";
import { z } from "zod";

/**
 * Solicitud de compra desde la vitrina del catálogo: cualquier persona del
 * campus puede pedir (RLS merch_producto_solicitudes_insert solo exige
 * mismo campus) — no rebaja stock sola, eso pasa al marcarla "Entregada"
 * (ver [id]/route.ts). solicitante/correo_solicitante siempre se fijan acá
 * desde la identidad real, nunca desde lo que mande el cliente.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const estado = searchParams.get("estado");
  const propias = searchParams.get("propias") === "1";

  const supabase = await createClient();
  let query = supabase.from("merch_producto_solicitudes").select("*").order("creado_en", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (estado) query = query.eq("estado", estado);
  if (propias) {
    const identidad = await identidadActuante(supabase);
    if (!identidad) return fail("No autenticado.", 401);
    query = query.eq("correo_solicitante", identidad.perfil.correo);
  }

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const SolicitudSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  producto_id: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(50).default(1),
  metodo_pago: z.enum(["Transferencia", "Presencial"], { error: () => "Elige cómo vas a pagar." }),
  comprobante: z.string().optional(),
  nota: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, SolicitudSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const { comprobante, ...resto } = parsedBody.data;
  let comprobante_url: string | null = null;
  try {
    if (comprobante) {
      comprobante_url = await subirFotoJpeg(comprobante, "merch-vitrina", `Solicitud - ${resto.campus} - ${Date.now()}.jpg`);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo subir el comprobante.", 400);
  }

  const { data, error } = await supabase
    .from("merch_producto_solicitudes")
    .insert({
      ...resto,
      comprobante_url,
      solicitante: identidad.perfil.nombre,
      correo_solicitante: identidad.perfil.correo,
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
