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
export function esPanorama(p: PerfilVisibilidad) {
  return esPastorC(p) || tiene(p, "Admin app");
}
export function esLider(p: PerfilVisibilidad) {
  return tiene(p, "Líder");
}
export function esConex(p: PerfilVisibilidad) {
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
 * en orden de prioridad — el resto de lo visible queda detrás de "Más".
 * Ministro/Administrador ven "reporte"/"aportes" (son esFin()) pero solo
 * a través de Administración, separados por campus — no sueltos en la
 * barra; ahí solo entran para Pastor/Pastor de campus/Pastor principal. */
export function clavesPrincipalesNav(p: PerfilVisibilidad): string[] {
  const visibles = [...modulosVisibles(p)].filter(
    (k) => k !== "inicio" && !((k === "aportes" || k === "reporte") && !esPastorC(p))
  );
  visibles.sort((a, b) => {
    const ia = PRIORIDAD_NAV.indexOf(a as (typeof PRIORIDAD_NAV)[number]);
    const ib = PRIORIDAD_NAV.indexOf(b as (typeof PRIORIDAD_NAV)[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return visibles.slice(0, 4);
}

/** De las claves de MODULOS_APP (la lista vieja) a las claves de nuestro
 * src/lib/modulos.ts (los tiles/rutas reales de esta migración). */
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
  administracion: "administracion",
};

/**
 * Puerto 1:1 de ADMIN_SUBNAV + adminSubnavPara() del client.js viejo:
 * para Ministro/Administrador, "Administración" es la ÚNICA puerta a Mi
 * equipo/Asistencia/Fondo de equipo/Conexión/Bajas/Estadísticas/Reporte/
 * Aportes (esFin() los saca del menú normal). Para Pastor/Pastor de
 * campus es la puerta a Turnos/Fondos/Reportes/Fechas de encuentro. El
 * campus en esta migración ya es el `campusActivo` global (el selector
 * del header), no uno propio de esta pantalla.
 */
export function adminSubnav(p: PerfilVisibilidad, campus: "Punta Arenas" | "Puerto Natales"): { clave: string; label: string; href: string }[] {
  const items: { clave: string; label: string; href: string; ok: boolean }[] = [
    { clave: "turnos", label: "Turnos", href: "/turnos", ok: esPastorC(p) },
    { clave: "fondos", label: "Fondos", href: "/fondos", ok: esPastorC(p) },
    { clave: "reportes", label: "Reportes", href: "/finanzas", ok: esPastorC(p) },
    { clave: "fechas", label: "Fechas de encuentro", href: "/fechas-encuentro", ok: esPastorC(p) && campus === "Puerto Natales" },
    { clave: "equipo", label: "Mi equipo", href: "/equipos", ok: esFin(p) && (esAlto(p) || esLider(p)) },
    { clave: "asistencia", label: "Asistencia", href: "/encuentros", ok: esFin(p) && (esAlto(p) || esLider(p)) },
    { clave: "fondo", label: "Fondo de equipo", href: "/fondos", ok: !esPastorC(p) && esFin(p) && fondosMios(p).length > 0 },
    { clave: "visitas", label: "Conexión", href: "/visitas", ok: esFin(p) && (esAlto(p) || tiene(p, "Administrador") || esConex(p)) },
    { clave: "solicitudes", label: "Bajas", href: "/bajas", ok: esFin(p) && !esAppAdmin(p) },
    { clave: "equipostats", label: "Estadísticas", href: "/estadisticas", ok: esFin(p) && esLider(p) && !esPanorama(p) },
    { clave: "reporte", label: "Reporte", href: "/finanzas", ok: !esPastorC(p) && esFin(p) },
    { clave: "aportes", label: "Aportes", href: "/encuentros", ok: !esPastorC(p) && esFin(p) },
  ];
  return items.filter((x) => x.ok);
}
