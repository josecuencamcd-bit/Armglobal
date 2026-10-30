import type { Database } from "./supabase/types";

type Rol = Database["public"]["Enums"]["rol_t"];
type Area = Database["public"]["Enums"]["area_t"];

const FONDO_AREAS: Area[] = ["Kids", "Tweens", "Técnica", "Worship", "Conexión", "Voluntariado"];

export type PerfilVisibilidad = {
  roles: Rol[];
  areas: Area[];
  sirve: Area[];
  modulos_on: string[];
  modulos_off: string[];
};

export function tiene(p: PerfilVisibilidad, r: Rol) {
  return p.roles.includes(r);
}
export function esPastorC(p: PerfilVisibilidad) {
  return tiene(p, "Pastor de campus") || tiene(p, "Pastor") || tiene(p, "Pastor principal");
}
export function esAlto(p: PerfilVisibilidad) {
  return esPastorC(p) || tiene(p, "Ministro");
}
export function esFin(p: PerfilVisibilidad) {
  return esAlto(p) || tiene(p, "Administrador");
}
function esPanorama(p: PerfilVisibilidad) {
  return esPastorC(p) || tiene(p, "Admin app");
}
export function esLider(p: PerfilVisibilidad) {
  return tiene(p, "Líder");
}
function esConex(p: PerfilVisibilidad) {
  return p.areas.includes("Conexión") || p.sirve.includes("Conexión");
}
export function fondosMios(p: PerfilVisibilidad): Area[] {
  if (esPastorC(p)) return FONDO_AREAS.slice();
  if (tiene(p, "Líder")) return p.areas.filter((a) => (FONDO_AREAS as string[]).includes(a));
  return [];
}
export function puedeSoporte(p: PerfilVisibilidad) {
  return tiene(p, "Admin app") || tiene(p, "Pastor de campus") || tiene(p, "Pastor");
}
export function esAppAdmin(p: PerfilVisibilidad) {
  return tiene(p, "Admin app");
}
/** puedeVerEquipo: a quién le muestra Inicio la tarjeta "Tu equipo" — un
 * Líder que no sea además un rol alto (ese ve el panel completo en
 * Estadísticas/Panorama, no esta tarjeta resumida). */
export function puedeVerEquipo(p: PerfilVisibilidad) {
  return esLider(p) && !esAlto(p);
}

/**
 * Puerto 1:1 de tabsPorRol() del client.js viejo: qué módulos ve cada
 * persona por defecto según su rol, combinado con las excepciones
 * explícitas que un Admin app haya guardado en perfiles.modulos_on/off
 * (pantalla /perfiles → "Módulos"). Antes esto no existía: el menú era el
 * mismo para todos sin importar lo que el admin activara/desactivara ahí.
 */
export function modulosVisibles(p: PerfilVisibilidad): Set<string> {
  const t = new Set<string>(["inicio"]);
  if (esPanorama(p)) { t.add("panorama"); t.add("stats"); }
  if (esFin(p)) { t.add("aportes"); t.add("reporte"); }
  if (esLider(p) && !esFin(p)) { t.add("equipo"); t.add("asistencia"); }
  if (esConex(p) && !esFin(p)) t.add("visitas");
  if (tiene(p, "Admin app")) t.add("solicitudes");
  if (fondosMios(p).length && !esFin(p)) t.add("fondo");
  if (esPastorC(p) || tiene(p, "Ministro") || tiene(p, "Administrador")) t.add("administracion");
  if (esLider(p) && !esPanorama(p) && !esFin(p)) t.add("equipostats");
  t.add("reuniones");
  t.add("miperfil");
  if (puedeSoporte(p)) t.add("soporte");
  t.add("cumples");

  for (const k of p.modulos_off ?? []) if (k !== "inicio") t.delete(k);
  for (const k of p.modulos_on ?? []) t.add(k);
  return t;
}

/** Mismo orden de pintarBottomNav() del client.js viejo: de todo lo que
 * esta persona tiene visible, los primeros 4 (según esta prioridad) van
 * sueltos en la barra inferior junto a Inicio; el resto queda detrás de
 * "Más". Antes la barra era fija (Inicio/Soporte/Bajas/Panorama/
 * Cumpleaños para todos) sin importar el rol — acá cada persona ve una
 * barra distinta, como en la app vieja. */
const PRIORIDAD_NAV = [
  "reporte", "aportes", "finanzas", "fondo", "informe", "asistencia", "equipo",
  "soporte", "visitas", "solicitudes", "panorama", "equipostats", "cumples",
  "reuniones", "miperfil",
] as const;

/** Las 4 claves (de la lista vieja) que van sueltas en la barra inferior,
 * en orden de prioridad — el resto de lo visible queda detrás de "Más". */
export function clavesPrincipalesNav(p: PerfilVisibilidad): string[] {
  const visibles = [...modulosVisibles(p)].filter((k) => k !== "inicio");
  visibles.sort((a, b) => {
    const ia = PRIORIDAD_NAV.indexOf(a as (typeof PRIORIDAD_NAV)[number]);
    const ib = PRIORIDAD_NAV.indexOf(b as (typeof PRIORIDAD_NAV)[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return visibles.slice(0, 4);
}

/** De las claves de MODULOS_APP (la lista vieja) a las claves de nuestro
 * src/lib/modulos.ts (los tiles/rutas reales de esta migración). Una
 * clave vieja sin equivalente directo (p. ej. "administracion", que no es
 * una pantalla única) se omite: no filtra nada por ese lado. */
export const CLAVE_A_MODULO_APP: Record<string, string> = {
  panorama: "panorama",
  cumpleanos: "cumples",
  fondos: "fondo",
  finanzas: "reporte",
  aportes: "aportes",
  equipos: "equipo",
  encuentros: "asistencia",
  visitas: "visitas",
  bajas: "solicitudes",
  soporte: "soporte",
  reuniones: "reuniones",
  perfil: "miperfil",
  estadisticas: "equipostats",
};
