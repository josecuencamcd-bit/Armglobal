import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";

function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
}

/**
 * api_ecoAvisos: recordatorios en Inicio — encuentros de días pasados que
 * nadie finalizó, e hilos de notas de área pendientes de cerrar. Si hay una
 * "vista como X" activa, se calcula para X (identidadActuante). No incluye
 * el aviso de cierre de mes de fondos: eso ya lo muestra cada pantalla
 * (Fondos/Finanzas) con su propia tarjeta "Cerrar mes".
 */
export async function GET() {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const areasPerfil = (perfil.areas as string[] | null) ?? [];
  const esAdmin = roles.includes("Admin app");
  const esPastorCampus = roles.includes("Pastor de campus") || roles.includes("Pastor principal");
  const esAdministrador = roles.includes("Administrador");
  const esLider = roles.includes("Líder");

  const hoy = hoyISO();
  const campusVisibles: readonly string[] =
    esAdmin || perfil.campus == null ? CAMPUS : [perfil.campus];

  try {
    const encuentros: { campus: string; encuentro: string; fecha: string; key: string }[] = [];
    if (esAdmin || esPastorCampus || esAdministrador) {
      const { data, error } = await supabase
        .from("sesiones")
        .select("key, campus, encuentro, fecha")
        .eq("finalizado", false)
        .lt("fecha", hoy)
        .in("campus", campusVisibles as unknown as ("Punta Arenas" | "Puerto Natales")[])
        .order("fecha", { ascending: true })
        .limit(10);
      if (error) throw error;
      (data ?? []).forEach((s) => encuentros.push(s));
    }

    const notas: { campus: string; area: string; fecha: string; key: string }[] = [];
    if (esLider && areasPerfil.length) {
      const { data, error } = await supabase
        .from("notas")
        .select("key, campus, area, fecha")
        .eq("finalizado", false)
        .lt("fecha", hoy)
        .in("campus", campusVisibles as unknown as ("Punta Arenas" | "Puerto Natales")[])
        .in("area", areasPerfil as unknown as ("Kids" | "Tweens" | "Técnica" | "Worship" | "Conexión" | "Voluntariado" | "Stand de Oración" | "Campus")[])
        .order("fecha", { ascending: true })
        .limit(10);
      if (error) throw error;
      (data ?? []).forEach((n) => notas.push(n));
    }

    return ok({ encuentros, notas, total: encuentros.length + notas.length });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
