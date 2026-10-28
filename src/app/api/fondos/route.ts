import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { z } from "zod";

/**
 * "Fondo de equipo" (= hoja "Fondo Voluntariado", que pese al nombre guarda
 * movimientos de TODAS las áreas vía su columna `area` — confirmado contra
 * datos reales en Fase 2). RLS (fondos_equipo_insert/select/update) deja
 * entrar a Finanzas de cualquier área, o a un líder/voluntario solo de su
 * propia área.
 *
 * NOTA: `tipo`/`estado` no tienen un CHECK en la base (quedaron como texto
 * libre al migrar la hoja), así que validamos acá con el mismo vocabulario
 * que usaba Code.gs ("Ingreso"/"Gasto", "Activo"/"Anulado"). Si al migrar
 * los datos reales aparece un valor distinto, hay que ampliar este enum.
 */
const TIPOS = ["Ingreso", "Gasto"] as const;

const RegistrarSchema = z.object({
  tipo: z.enum(TIPOS, { error: () => "Tipo no válido." }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  nombre: z.string().trim().max(120).optional(),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  metodo: z.string().trim().max(40).optional(),
  comercio: z.string().trim().max(120).optional(),
  boleta: z.string().trim().max(60).optional(),
  descripcion: z.string().trim().max(300).optional(),
  foto_url: z.string().url().optional(),
  categoria: z.string().trim().max(60).optional(),
  motivo: z.string().trim().max(300).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campusParam = searchParams.get("campus");
  const areaParam = searchParams.get("area");
  const campus = CAMPUS.find((c) => c === campusParam);
  const area = AREAS.find((a) => a === areaParam);

  const supabase = await createClient();
  let query = supabase.from("fondos_equipo").select("*").order("fecha", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

/** Equivalente a "registrar" un movimiento de fondo. */
export async function POST(req: Request) {
  const parsedBody = await parseBody(req, RegistrarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: perfil } = user
      ? await supabase.from("perfiles").select("correo").eq("id", user.id).single()
      : { data: null };

    // "tardío" = registrado más de 7 días después de la fecha del gasto,
    // misma regla que usaba el vigilante de fondos para marcar atrasos.
    const diasDesdeFecha = Math.floor(
      (Date.now() - new Date(`${parsedBody.data.fecha}T00:00:00Z`).getTime()) / 86_400_000
    );

    const { data, error } = await supabase
      .from("fondos_equipo")
      .insert({
        ...parsedBody.data,
        estado: "Activo",
        por: perfil?.correo ?? null,
        tardio: diasDesdeFecha > 7,
      })
      .select()
      .single();
    if (error) throw error;
    return ok(data, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
