import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { AREAS, CAMPUS } from "@/lib/sesiones";

type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];

export const ESTADOS_ASIS = ["Vino", "No vino", "Avisó"] as const;

/**
 * ctxEco_ de Code.gs: ¿puede esta persona ver/editar la asistencia de este
 * campus+área? `lider` = puede marcar (soloLider_); `puedeVer` = puede al
 * menos ver de solo lectura (verEquipo_: líder o alguien de Finanzas —
 * Pastor/Ministro/Administrador/Admin app).
 */
export function ctxAsistencia(perfil: Perfil, campus: string, area: string) {
  const roles = (perfil.roles as string[] | null) ?? [];
  const areas = (perfil.areas as string[] | null) ?? [];
  const esLider = roles.includes("Líder");
  const esFinanzas =
    roles.includes("Pastor principal") ||
    roles.includes("Pastor de campus") ||
    roles.includes("Pastor") ||
    roles.includes("Ministro") ||
    roles.includes("Administrador") ||
    roles.includes("Admin app");
  const lider = esLider && areas.includes(area) && (perfil.campus == null || perfil.campus === campus);
  const puedeVer = lider || esFinanzas;
  return { lider, puedeVer, esFinanzas };
}

export function claveNota(campus: string, area: string, fecha: string) {
  return [campus, area, fecha].join("|");
}

export function campusValido(v: string | null): v is (typeof CAMPUS)[number] {
  return (CAMPUS as readonly string[]).includes(v ?? "");
}
export function areaValida(v: string | null): v is (typeof AREAS)[number] {
  return (AREAS as readonly string[]).includes(v ?? "");
}

/** Nombre "parecido" de la ficha a un integrante real — versión simple de
 * mismoNombre_/buscarIntegrante_ de Code.gs (primer nombre igual + algo de
 * tolerancia en el resto), suficiente para cruzar la ficha manual contra
 * Mi equipo sin reescribir el algoritmo fuzzy completo. */
export function nombreParecido(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
  const na = norm(a).split(/\s+/);
  const nb = norm(b).split(/\s+/);
  if (!na.length || !nb.length || na[0] !== nb[0]) return false;
  if (na.length === 1 || nb.length === 1) return true;
  return na.slice(1).some((t) => nb.slice(1).some((x) => x === t || x.startsWith(t) || t.startsWith(x)));
}

/** fichaTurno_: quién administra ese día según la ficha (administradores
 * de campus, y en Voluntariado quién lidera el equipo) — a partir de
 * fichas_servicio, que ahora el líder carga a mano en "Mi equipo" en vez de
 * sincronizarse sola desde una hoja externa. */
export async function fichaAdministracion(supabase: SupabaseClient<Database>, campus: string, area: string, fecha: string) {
  if (campus !== "Punta Arenas") return null;
  const { data } = await supabase.from("fichas_servicio").select("area, puesto, nombre").eq("fecha", fecha);
  const administradores = new Set<string>();
  const lideres = new Set<string>();
  (data ?? []).forEach((r) => {
    if (!r.nombre) return;
    if (/administraci[oó]n/i.test(r.area) || /administrador de turno/i.test(r.puesto)) administradores.add(r.nombre);
    else if (/l[ií]der del equipo/i.test(r.puesto) && area === "Voluntariado") lideres.add(r.nombre);
  });
  if (!administradores.size && !lideres.size) return null;
  return { administradores: [...administradores], lideres: [...lideres] };
}

/** fichaFaltantes_: nombres que la ficha menciona para esta área/fecha pero
 * que no están registrados en Mi equipo. */
export async function fichaFaltantes(
  supabase: SupabaseClient<Database>,
  campus: string,
  area: string,
  fecha: string,
  integrantesNombres: string[]
): Promise<string[]> {
  if (campus !== "Punta Arenas") return [];
  const { data } = await supabase.from("fichas_servicio").select("nombre, puesto").eq("area", area).eq("fecha", fecha);
  const vistos = new Set<string>();
  const faltan: string[] = [];
  (data ?? []).forEach((r) => {
    if (!r.nombre || /l[ií]der del equipo/i.test(r.puesto)) return;
    const k = r.nombre.toLowerCase();
    if (vistos.has(k)) return;
    vistos.add(k);
    if (!integrantesNombres.some((n) => nombreParecido(r.nombre!, n))) faltan.push(r.nombre);
  });
  return faltan;
}
