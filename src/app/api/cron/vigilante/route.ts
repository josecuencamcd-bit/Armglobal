import { createAdminClient } from "@/lib/supabase/admin";
import { encuentrosPendientes, notasPendientes, checklistsPendientes, encuentrosPorIniciar, destinatariosChecklist, destinatariosChecklistResponsables, debeAvisar, vigilanteFondos, pausaEncuentrosActiva } from "@/lib/vigilantes";
import { cumpleVigilante } from "@/lib/cumpleanos";
import { enviarWhatsApp, telefonoWa } from "@/lib/whatsapp";
import { avisarAdmins } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Puerto de `cumpleVigilante_()` (el trigger de 15 min de Code.gs que
 * llamaba a vigilanteFondos_/vigilanteEncuentros_/vigilanteNotas_, y que
 * también creaba/mandaba los saludos de cumpleaños — no confundir con el
 * `cumpleVigilante` importado acá, que es justo esa última parte portada).
 * Pensado como Vercel Cron Job (ver vercel.json) corriendo cada 15 min.
 *
 * Cubierto: encuentros pendientes de finalizar (vigilanteEncuentros_),
 * áreas que no cerraron su asistencia (vigilanteNotas_, throttle vía
 * `avisos_vigilante`), cierre automático de mes + recordatorio de fondos
 * sin cerrar (vigilanteFondos_, por correo vía Resend), y los saludos de
 * cumpleaños (crear/aprobar-recordar/enviar, también por Resend).
 *
 * Pendiente: encuentros/notas siguen avisando por WhatsApp (sin
 * credenciales configuradas por decisión explícita del usuario — "no
 * usaremos WhatsApp por ahora"), a diferencia de vigilanteFondos_ y
 * cumpleVigilante_ que siempre fueron por correo en Code.gs y acá ya usan
 * Resend.
 */
export async function GET(req: Request) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const resultado = {
    encuentros_avisados: 0,
    notas_avisadas: 0,
    checklist_avisados: 0,
    checklist_previos: 0,
    roles_aplicados: 0,
    fondos_cerrados: 0,
    fondos_avisos: 0,
    cumples_creados: 0,
    cumples_enviados: 0,
    cumples_recordados: 0,
  };

  const { data: rolesAplicados } = await supabase.rpc("aplicar_roles_programados");
  resultado.roles_aplicados = rolesAplicados ?? 0;

  const fondos = await vigilanteFondos(supabase);
  resultado.fondos_cerrados = fondos.meses_cerrados;
  resultado.fondos_avisos = fondos.avisos;

  const cumples = await cumpleVigilante(supabase);
  resultado.cumples_creados = cumples.creadas;
  resultado.cumples_enviados = cumples.enviadas;
  resultado.cumples_recordados = cumples.recordadas;

  // Pausa manual de alarmas de encuentros (pendientes, notas, checklist y
  // checklist previo) mientras la app sigue en construcción — ver
  // `pausaEncuentrosActiva`. No afecta vigilanteFondos ni cumpleVigilante,
  // que son avisos de otra naturaleza y siguen corriendo igual.
  const pausado = await pausaEncuentrosActiva(supabase);

  const pendEncuentros = pausado ? [] : await encuentrosPendientes(supabase);
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

  const pendNotas = pausado ? [] : await notasPendientes(supabase);
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

  // Recordatorio por correo del Checklist pre-encuentro sin cerrar — a
  // diferencia de encuentros/notas (WhatsApp, aún sin credenciales), este
  // va por Resend al administrador responsable, Admin app y equipo
  // pastoral del campus (ver ROLES_CHECKLIST).
  const pendChecklist = pausado ? [] : await checklistsPendientes(supabase);
  for (const e of pendChecklist) {
    const key = [e.campus, e.encuentro, e.fecha].join("|");
    if (!(await debeAvisar(supabase, "checklist", key, e.hoy))) continue;

    const destinatarios = await destinatariosChecklistResponsables(supabase, e.campus, e.fecha);
    const cuando = e.hoy ? "hoy" : `del ${e.fecha.split("-").reverse().join("/")}`;
    try {
      await avisarAdmins({
        destinatarios,
        asunto: `Falta cerrar el Checklist pre encuentro · Campus ${e.campus}`,
        titulo: "Checklist pre encuentro sin finalizar",
        datos: [
          ["Encuentro", `${e.encuentro} (${cuando})`],
          ["Campus", e.campus],
        ],
        nota: "Nadie marcó el Checklist pre encuentro como finalizado. Revísalo y ciérralo en la app.",
      });
      resultado.checklist_avisados++;
    } catch {
      // un fallo de correo no debe bloquear el resto de los avisos
    }
  }

  // Aviso previo: 15 min antes de que arranque el encuentro, para que el
  // responsable asignado (y el administrador/equipo pastoral en copia)
  // alcancen a dejar el Checklist pre-encuentro listo. Solo si todavía no
  // está finalizado — si ya lo cerraron antes, no hace falta molestar.
  const porIniciar = pausado ? [] : await encuentrosPorIniciar();
  for (const e of porIniciar) {
    const key = [e.campus, e.encuentro, e.fecha].join("|");
    if (!(await debeAvisar(supabase, "checklist-previo", key, true))) continue;

    const { data: sesion } = await supabase
      .from("sesiones")
      .select("checklist_finalizado")
      .eq("campus", e.campus)
      .eq("encuentro", e.encuentro)
      .eq("fecha", e.fecha)
      .is("evento", null)
      .maybeSingle();
    if (sesion?.checklist_finalizado) continue;

    const destinatarios = await destinatariosChecklist(supabase, e.campus, e.fecha);
    try {
      await avisarAdmins({
        destinatarios,
        asunto: `Checklist pre encuentro — empieza en 15 min · Campus ${e.campus}`,
        titulo: "El encuentro está por empezar",
        datos: [
          ["Encuentro", e.encuentro],
          ["Campus", e.campus],
        ],
        nota: "Faltan 15 minutos para que empiece. Deja listo y cierra el Checklist pre encuentro en la app.",
      });
      resultado.checklist_previos++;
    } catch {
      // un fallo de correo no debe bloquear el resto de los avisos
    }
  }

  return Response.json({ ok: true, ...resultado });
}
