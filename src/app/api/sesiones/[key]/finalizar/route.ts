import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { ArgsSchema } from "@/lib/sesiones";
import { leerSesion, asegurarSesion } from "@/lib/sesiones-db";
import { destinatariosChecklist } from "@/lib/vigilantes";
import { avisarAdmins } from "@/lib/email";
import { z } from "zod";

const Schema = z.object({
  finalizado: z.boolean().optional().default(true),
  // "general" = Reporte (asistencia/voluntarios/aceptaron), "aportes" =
  // Aportes, "checklist" = Checklist pre-encuentro. Tres cierres
  // independientes: cada administrador cierra su propia parte cuando
  // termina. El encuentro completo (lo que revisa el vigilante automático)
  // se da por cerrado solo cuando las tres lo están.
  campo: z.enum(["general", "aportes", "checklist"]).optional().default("general"),
});

/** api_finalizar: marca (o desmarca, para "reabrir" el mismo día) el
 * Reporte, los Aportes o el Checklist de un encuentro como finalizados. El
 * verdadero candado para editar pasado el día del encuentro es
 * auth_mismo_dia()/auth_autorizado() en RLS — estos flags no bloquean la
 * edición por sí solos, solo registran qué parte quedó cerrada para quien
 * la revise después (y para el vigilante automático). */
export async function POST(req: Request, context: { params: Promise<{ key: string }> }
) {
  const params = await context.params;
  const [campus, encuentro, evento, fecha] = decodeURIComponent(params.key).split("|");
  const parsed = ArgsSchema.safeParse({ campus, encuentro, evento, fecha });
  if (!parsed.success) return fail("Encuentro no válido.");
  const args = parsed.data;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // sin body: se mantiene el default (finalizar)
  }
  const parsedBody = Schema.safeParse(body);
  if (!parsedBody.success) return fail("Valor no válido.");

  const supabase = await createClient();
  try {
    const key = await asegurarSesion(supabase, args);
    const ahora = new Date().toISOString();
    const cambios =
      parsedBody.data.campo === "aportes"
        ? { aportes_finalizado: parsedBody.data.finalizado, actualizado: ahora }
        : parsedBody.data.campo === "checklist"
        ? { checklist_finalizado: parsedBody.data.finalizado, actualizado: ahora }
        : { finalizado: parsedBody.data.finalizado, actualizado: ahora };
    const { error } = await supabase.from("sesiones").update(cambios).eq("key", key);
    if (error) throw error;
    const sesionLeida = await leerSesion(supabase, args);

    // Al quedar listo el Checklist pre-encuentro, avisa de inmediato (no
    // espera al cron) al administrador responsable, Admin app y equipo
    // pastoral del campus — mismo criterio de destinatarios que el
    // recordatorio de "sigue sin cerrarse" en vigilantes.ts.
    if (parsedBody.data.campo === "checklist" && parsedBody.data.finalizado) {
      try {
        const destinatarios = await destinatariosChecklist(supabase, args.campus, args.fecha);
        await avisarAdmins({
          destinatarios,
          asunto: `Checklist pre encuentro listo · Campus ${args.campus}`,
          titulo: "El Checklist pre encuentro quedó finalizado",
          datos: [
            ["Encuentro", `${args.encuentro} · ${args.fecha.split("-").reverse().join("/")}`],
            ["Campus", args.campus],
            ["Responsable", sesionLeida.responsable],
          ],
          nota: "Ya puedes revisarlo entrando al Checklist de ese encuentro en la app.",
        });
      } catch {
        // un fallo de correo no debe bloquear el cierre del checklist
      }
    }

    return ok(sesionLeida);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
