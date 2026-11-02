import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { identidadActuante } from "@/lib/identidad";
import { ctxAsistencia, claveNota, campusValido, areaValida } from "@/lib/asistencia";
import { z } from "zod";

/** api_ecoFinalizar: cierra el encuentro del área (ya no se puede editar) y
 * arma el mismo mensaje de respaldo que la app vieja, para compartir por
 * WhatsApp. */
const Schema = z.object({
  campus: z.string(),
  area: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  nota: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, Schema);
  if ("error" in parsedBody) return parsedBody.error;
  const { campus, area, fecha, nota } = parsedBody.data;
  if (!campusValido(campus)) return fail("Campus no válido.", 400);
  if (!areaValida(area)) return fail("Área no válida.", 400);

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const { lider } = ctxAsistencia(identidad.perfil, campus, area);
  if (!lider) return fail("Esta acción es solo del líder del área.", 403);

  try {
    const key = claveNota(campus, area, fecha);
    const { data: notaRow, error: eNota } = await supabase.from("notas").select("finalizado, nota").eq("key", key).maybeSingle();
    if (eNota) throw eNota;
    if (notaRow?.finalizado) return fail("Este encuentro ya fue finalizado.", 409);

    const { data: filas, error: eFilas } = await supabase
      .from("integrante_seguimiento")
      .select("nombre, estado, observacion")
      .eq("campus", campus)
      .eq("area", area)
      .eq("fecha", fecha)
      .neq("estado", "Quitado");
    if (eFilas) throw eFilas;
    if (!filas || !filas.length) return fail("Programa primero a quienes sirven ese día.", 400);

    const notaFinal = nota ?? notaRow?.nota ?? "";
    const cuenta: Record<string, string[]> = { Vino: [], Avisó: [], "No vino": [], "": [] };
    filas.forEach((p) => {
      const k = p.estado && cuenta[p.estado] ? p.estado : "";
      cuenta[k].push(p.nombre + (p.observacion ? ` [${p.observacion}]` : ""));
    });
    const [y, m, d] = fecha.split("-");
    const lineas = [`armglobal - ${area} - Campus ${campus}`, `Encuentro del ${d}/${m}/${y}`, ""];
    (["Vino", "Avisó", "No vino", ""] as const).forEach((k) => {
      if (!cuenta[k].length) return;
      lineas.push(`${k || "Sin marcar"} (${cuenta[k].length}): ${cuenta[k].join(", ")}`);
    });
    if (notaFinal) {
      lineas.push("");
      lineas.push(`Notas: ${notaFinal}`);
    }
    lineas.push("");
    lineas.push(`Registrado por ${identidad.perfil.nombre}`);

    const { error: eUpsert } = await supabase.from("notas").upsert({
      key,
      campus,
      area,
      fecha,
      nota: notaFinal,
      finalizado: true,
      por: identidad.perfil.correo,
      hora: new Date().toTimeString().slice(0, 8),
      actualizado: new Date().toISOString(),
    });
    if (eUpsert) throw eUpsert;

    return ok({ mensaje: lineas.join("\n") });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
