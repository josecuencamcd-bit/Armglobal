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

function tiene(p: PerfilVisibilidad, r: Rol) {
  return p.roles.includes(r);
}
function esPastorC(p: PerfilVisibilidad) {
  return tiene(p, "Pastor de campus") || tiene(p, "Pastor") || tiene(p, "Pastor principal");
}
function esAlto(p: PerfilVisibilidad) {
  return esPastorC(p) || tiene(p, "Ministro");
}
function esFin(p: PerfilVisibilidad) {
  return esAlto(p) || tiene(p, "Administrador");
}
function esPanorama(p: PerfilVisibilidad) {
  return esPastorC(p) || tiene(p, "Admin app");
}
function esLider(p: PerfilVisibilidad) {
  return tiene(p, "Líder");
}
function esConex(p: PerfilVisibilidad) {
  return p.areas.includes("Conexión") || p.sirve.includes("Conexión");
}
function fondosMios(p: PerfilVisibilidad): Area[] {
  if (esPastorC(p)) return FONDO_AREAS.slice();
  if (tiene(p, "Líder")) return p.areas.filter((a) => (FONDO_AREAS as string[]).includes(a));
  return [];
}
function puedeSoporte(p: PerfilVisibilidad) {
  return tiene(p, "Admin app") || tiene(p, "Pastor de campus") || tiene(p, "Pastor");
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
