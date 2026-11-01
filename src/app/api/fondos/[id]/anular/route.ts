import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

const AnularSchema = z.object({
  motivo: z.string().trim().min(5, "Cuenta el motivo de la anulación.").max(200),
});

/** "Anular" un movimiento: Code.gs nunca borra filas de fondos (hay que
 * poder auditarlas), solo las marca — y SIEMPRE exige motivo (api_fonAnular,
 * min. 5 caracteres), no solo cuando el mes está cerrado. RLS
 * (fondos_equipo_update) exige la misma área (o Finanzas) que para
 * registrar, y además bloquea un mes cerrado salvo Pastor de campus o
 * autorización vigente (fondos_equipo_update). Si hay una "vista como X"
 * activa, queda anulado a nombre de X (ver identidadActuante). */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const parsedBody = await parseBody(req, AnularSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  try {
    const identidad = await identidadActuante(supabase);

    const { data, error, count } = await supabase
      .from("fondos_equipo")
      .update(
        {
          estado: "Anulado",
          motivo: parsedBody.data.motivo,
          anulado_por: identidad?.perfil.correo ?? null,
          anulado_en: new Date().toISOString(),
        },
        { count: "exact" }
      )
      .eq("id", Number(params.id))
      .select()
      .maybeSingle();
    if (error) throw error;
    if (count === 0) return fail("No tienes permiso para anular esto, el mes está cerrado y necesitas autorización, o el registro no existe.", 403);
    return ok(data);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
