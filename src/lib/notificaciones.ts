import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CAMPUS, claveSesion } from "./sesiones";
import { encuentrosVencidos } from "./vigilantes";
import { administracionDeLaSemana } from "./sesiones-db";

type DB = SupabaseClient<Database>;
type Campus = (typeof CAMPUS)[number];

export type NotificacionPendiente = {
  campus: Campus;
  encuentro: string;
  fecha: string;
  area: "Reporte" | "Aportes" | "Checklist";
  mensaje: string;
  href: string;
  /** Si quien pide la lista es uno de los responsables asignados esa
   * semana: solo a esa persona se le genera la ruta para ir directo a
   * cerrarlo — al resto le llega igual, pero solo como información. */
  esResponsable: boolean;
};

/**
 * Bandeja de "Notificaciones": encuentros vencidos (misma ventana que el
 * vigilante automático — hoy pasada la hora límite, o de los 2 días
 * anteriores) con alguna de sus tres áreas (Reporte/Aportes/Checklist)
 * todavía sin cerrar, para el campus que esté mirando quien pide la lista.
 * `nombreUsuario` decide, por encuentro, si esa persona es una de las
 * asignadas esa semana en Administración semanal (mismo responsable para
 * las tres áreas).
 */
export async function notificacionesPendientes(db: DB, campus: Campus, nombreUsuario: string): Promise<NotificacionPendiente[]> {
  const vencidos = encuentrosVencidos().filter((e) => e.campus === campus);
  const out: NotificacionPendiente[] = [];

  for (const e of vencidos) {
    const [{ data: sesion }, nombresAsignados] = await Promise.all([
      db
        .from("sesiones")
        .select("finalizado, aportes_finalizado, checklist_finalizado")
        .eq("campus", e.campus)
        .eq("encuentro", e.encuentro)
        .eq("fecha", e.fecha)
        .is("evento", null)
        .maybeSingle(),
      administracionDeLaSemana(db, e.campus, e.fecha),
    ]);

    const esResponsable = nombresAsignados.includes(nombreUsuario);
    const key = encodeURIComponent(claveSesion({ campus: e.campus, encuentro: e.encuentro, evento: "", fecha: e.fecha }));
    const cuando = e.hoy ? "hoy" : `del ${e.fecha.split("-").reverse().join("/")}`;

    const areas: { area: NotificacionPendiente["area"]; cerrado: boolean; href: string }[] = [
      { area: "Reporte", cerrado: !!sesion?.finalizado, href: `/encuentros/${key}` },
      { area: "Aportes", cerrado: !!sesion?.aportes_finalizado, href: `/encuentros/${key}/aportes` },
      { area: "Checklist", cerrado: !!sesion?.checklist_finalizado, href: `/encuentros/${key}/checklist` },
    ];

    for (const a of areas) {
      if (a.cerrado) continue;
      out.push({
        campus: e.campus,
        encuentro: e.encuentro,
        fecha: e.fecha,
        area: a.area,
        mensaje: `Falta cerrar ${a.area} de ${e.encuentro} (${cuando}).`,
        href: a.href,
        esResponsable,
      });
    }
  }

  return out;
}
