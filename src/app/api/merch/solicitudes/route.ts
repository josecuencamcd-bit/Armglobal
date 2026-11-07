import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS, TALLAS } from "@/lib/sesiones";
import { subirFotoJpeg } from "@/lib/fotos";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

/**
 * Solicitud de polera/polerón: cualquier líder la arma para un integrante
 * de su propia área (RLS merch_solicitudes_insert: area = ANY(auth_areas())),
 * adjuntando cómo pagó (Transferencia/Efectivo) y el comprobante. Le llega
 * al líder de Merch (o Finanzas) para aprobar/rechazar/marcar entregada —
 * merch_solicitudes_select ya deja ver TODAS las solicitudes a quien tiene
 * área "Merch", y solo las propias a cualquier otro líder.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));
  const estado = searchParams.get("estado");

  const supabase = await createClient();
  let query = supabase.from("merch_solicitudes").select("*").order("creado_en", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);
  if (estado) query = query.eq("estado", estado);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

const SolicitudSchema = z.object({
  campus: z.enum(CAMPUS),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  integrante_id: z.number().int().positive(),
  tipo: z.enum(["Polera", "Polerón"], { error: () => "Elige polera o polerón." }),
  talla: z.enum(TALLAS, { error: () => "Talla no válida." }),
  cantidad: z.number().int().min(1).max(50).default(1),
  metodo_pago: z.enum(["Transferencia", "Efectivo"], { error: () => "Elige cómo se pagó." }),
  // Mismo patrón que /api/gastos-campus: llega como data URL jpeg y se sube
  // server-side al bucket privado "fotos" — el cliente nunca maneja la URL.
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
      comprobante_url = await subirFotoJpeg(
        comprobante,
        "merch",
        `Solicitud - ${resto.campus} - ${resto.area} - ${Date.now()}.jpg`
      );
    }
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }

  const { data, error } = await supabase
    .from("merch_solicitudes")
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
