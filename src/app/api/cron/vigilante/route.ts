import { createAdminClient } from "@/lib/supabase/admin";
import { encuentrosPendientes, notasPendientes, debeAvisar, vigilanteFondos } from "@/lib/vigilantes";
import { enviarWhatsApp, telefonoWa } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Puerto de `cumpleVigilante_()` (el trigger de 15 min de Code.gs que
 * llamaba a vigilanteFondos_/vigilanteEncuentros_/vigilanteNotas_).
 * Pensado como Vercel Cron Job (ver vercel.json) corriendo cada 15 min.
 *
 * Cubierto: encuentros pendientes de finalizar (vigilanteEncuentros_),
 * áreas que no cerraron su asistencia (vigilanteNotas_, throttle vía
 * `avisos_vigilante`) y cierre automático de mes + recordatorio de fondos
 * sin cerrar (vigilanteFondos_, por correo vía Resend).
 *
 * Pendiente, NO fabricado para no fingir fidelidad que no es real:
 * - cumpleVigilante_ propiamente tal (crear/enviar saludos de cumpleaños —
 *   necesita portar cumpleCrear_/cumpleEnviar_/cumpleHtml_, que componen un
 *   mensaje largo con imágenes embebidas en base64 — plantillas de Code.gs
 *   no revisadas en este pase, queda como tarea aparte)
 * - encuentros/notas siguen avisando por WhatsApp (sin credenciales
 *   configuradas por decisión explícita del usuario — "no usaremos
 *   WhatsApp por ahora"), a diferencia de vigilanteFondos_ que siempre fue
 *   por correo en Code.gs y acá ya usa Resend.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const resultado = { encuentros_avisados: 0, notas_avisadas: 0, roles_aplicados: 0, fondos_cerrados: 0, fondos_avisos: 0 };

  const { data: rolesAplicados } = await supabase.rpc("aplicar_roles_programados");
  resultado.roles_aplicados = rolesAplicados ?? 0;

  const fondos = await vigilanteFondos(supabase);
  resultado.fondos_cerrados = fondos.meses_cerrados;
  resultado.fondos_avisos = fondos.avisos;

  const pendEncuentros = await encuentrosPendientes(supabase);
  for (const e of pendEncuentros) {
    const key = [e.campus, e.encuentro, e.fecha].join("|");
    if (!(await debeAvisar(supabase, "encuentros", key, e.hoy))) continue;

    const { data: destinatarios } = await supabase
      .from("perfiles")
      .select("telefono")
      .eq("campus", e.campus)
      .overlaps("roles", ["Administrador", "Pastor de campus", "Admin app"])
      .not("telefono", "is", null);

    const cuando = e.hoy ? "hoy" : `del ${e.fecha.split("-").reverse().join("/")}`;
    const texto = `⚠️ Hay un encuentro pendiente: ${e.encuentro} (${cuando}) · Campus ${e.campus}.\nFalta finalizar el encuentro en la app.`;
    await Promise.all((destinatarios ?? []).map((d) => enviarWhatsApp(telefonoWa(d.telefono), texto)));
    resultado.encuentros_avisados++;
  }

  const pendNotas = await notasPendientes(supabase);
  for (const e of pendNotas) {
    const key = [e.campus, e.area, e.encuentro, e.fecha].join("|");
    if (!(await debeAvisar(supabase, "notas", key, e.hoy))) continue;

    const { data: destinatarios } = await supabase
      .from("perfiles")
      .select("telefono")
      .eq("campus", e.campus)
      .overlaps("roles", ["Líder"])
      .overlaps("areas", [e.area])
      .not("telefono", "is", null);

    const cuando = e.hoy ? "hoy" : `del ${e.fecha.split("-").reverse().join("/")}`;
    const texto = `⚠️ Falta finalizar la asistencia de ${e.area} en ${e.encuentro} (${cuando}) · Campus ${e.campus}.`;
    await Promise.all((destinatarios ?? []).map((d) => enviarWhatsApp(telefonoWa(d.telefono), texto)));
    resultado.notas_avisadas++;
  }

  return Response.json({ ok: true, ...resultado });
}
