import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { ctxAsistencia, claveNota, campusValido, areaValida } from "@/lib/asistencia";
import { z } from "zod";

/**
 * api_ecoProgramar: define quiénes sirven ese día. Conserva lo ya marcado
 * de quienes siguen en la lista; a quien se sacó y todavía no tenía estado
 * marcado se le pone "Quitado" (no se borra la fila, por si vuelve a
 * entrar); a quien estaba "Quitado" y vuelve a la lista se le limpia el
 * estado.
 */
const Schema = z.object({
  campus: z.string(),
  area: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  ids: z.array(z.number().int()),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, Schema);
  if ("error" in parsedBody) return parsedBody.error;
  const { campus, area, fecha, ids } = parsedBody.data;
  if (!campusValido(campus)) return fail("Campus no válido.", 400);
  if (!areaValida(area)) return fail("Área no válida.", 400);

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const { lider } = ctxAsistencia(identidad.perfil, campus, area);
  if (!lider) return fail("Esta acción es solo del líder del área.", 403);

  try {
    const { data: notaRow, error: eNota } = await supabase.from("notas").select("finalizado").eq("key", claveNota(campus, area, fecha)).maybeSingle();
    if (eNota) throw eNota;
    if (notaRow?.finalizado) return fail("Este encuentro ya fue finalizado.", 409);

    const { data: equipo, error: eEquipo } = await supabase
      .from("integrantes")
      .select("id, nombre")
      .eq("campus", campus)
      .eq("area", area)
      .neq("estado", "Baja");
    if (eEquipo) throw eEquipo;
    const porId = new Map((equipo ?? []).map((p) => [p.id, p.nombre]));

    const { data: ya, error: eYa } = await supabase
      .from("integrante_seguimiento")
      .select("id, integrante_id, estado")
      .eq("campus", campus)
      .eq("area", area)
      .eq("fecha", fecha);
    if (eYa) throw eYa;
    const tiene = new Map((ya ?? []).filter((p) => p.integrante_id != null).map((p) => [p.integrante_id as number, p]));

    const idsSet = new Set(ids);
    const actualizaciones: PromiseLike<unknown>[] = [];
    for (const p of ya ?? []) {
      if (p.integrante_id != null && !idsSet.has(p.integrante_id) && !p.estado) {
        actualizaciones.push(supabase.from("integrante_seguimiento").update({ estado: "Quitado" }).eq("id", p.id));
      }
    }
    for (const id of ids) {
      if (!porId.has(id)) continue;
      const existente = tiene.get(id);
      if (existente) {
        if (existente.estado === "Quitado") {
          actualizaciones.push(supabase.from("integrante_seguimiento").update({ estado: "" }).eq("id", existente.id));
        }
        continue;
      }
      actualizaciones.push(
        supabase.from("integrante_seguimiento").insert({
          campus,
          area,
          fecha,
          integrante_id: id,
          nombre: porId.get(id),
          estado: "",
          marcado_por: identidad.perfil.correo,
        })
      );
    }
    await Promise.all(actualizaciones.map((p) => Promise.resolve(p)));
    return ok({ actualizado: true });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
