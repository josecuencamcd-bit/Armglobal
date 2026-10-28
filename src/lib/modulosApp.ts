/** Módulos que el Admin app puede activar/desactivar por persona
 * (perfiles.modulos_on/off) y renombrar (tabla nombres_modulo) — mismo
 * enum MODULOS_APP / DEFAULTS_NOMBRE_MOD que el client.js viejo. No es la
 * misma lista que src/lib/modulos.ts (esos son los módulos de ESTA
 * migración; estos son los botones/secciones de la app original). */
export const MODULOS_APP = [
  "panorama", "stats", "equipo", "asistencia", "visitas", "solicitudes",
  "fondo", "finanzas", "informe", "equipostats", "reuniones", "miperfil", "cumples",
] as const;

export const TITULOS_MOD: Record<string, string> = {
  panorama: "Panorama",
  stats: "Estadísticas del campus",
  equipo: "Mi equipo",
  asistencia: "Asistencia",
  visitas: "Conexión",
  solicitudes: "Bajas",
  fondo: "Fondo de equipo",
  finanzas: "Finanzas",
  informe: "Informe",
  equipostats: "Estadísticas del equipo",
  reuniones: "Reuniones",
  miperfil: "Mi perfil",
  cumples: "Cumpleaños",
};

/** Todos los botones que se pueden renombrar desde Soporte → Nombres (suma
 * soporte/aportes/reporte, que no son activables por persona pero sí
 * renombrables). */
export const DEFAULTS_NOMBRE_MOD: Record<string, string> = {
  ...TITULOS_MOD,
  soporte: "Soporte",
  aportes: "Aportes",
  reporte: "Reporte",
};
