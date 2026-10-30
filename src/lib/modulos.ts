/** Menú de módulos de la app, compartido entre el nav inferior y /inicio —
 * mismo set que el HTML embebido de Code.gs. `listo:false` = todavía no
 * migrado a Supabase (aparece marcado "Pronto", sin link). */
export type Modulo = { key: string; label: string; href: string; icon: string; listo: boolean };

/** `icon` es la clave del objeto ICONOS (src/lib/iconos.tsx), porteado 1:1
 * del SVG de la app vieja — no emoji. */
export const MODULOS: Modulo[] = [
  { key: "inicio", label: "Inicio", href: "/inicio", icon: "inicio", listo: true },
  { key: "soporte", label: "Soporte", href: "/soporte", icon: "soporte", listo: true },
  { key: "bajas", label: "Bajas", href: "/bajas", icon: "bajas", listo: true },
  { key: "panorama", label: "Panorama", href: "/panorama", icon: "panorama", listo: true },
  { key: "cumpleanos", label: "Cumpleaños", href: "/cumpleanos", icon: "cumples", listo: true },
  { key: "encuentros", label: "Asistencia", href: "/encuentros", icon: "asistencia", listo: true },
  { key: "fondos", label: "Fondo de equipo", href: "/fondos", icon: "fondo", listo: true },
  { key: "finanzas", label: "Reporte", href: "/finanzas", icon: "finanzas", listo: true },
  { key: "equipos", label: "Mi equipo", href: "/equipos", icon: "equipo", listo: true },
  { key: "turnos", label: "Turnos", href: "/turnos", icon: "turnos", listo: true },
  // Solo tiene sentido en Puerto Natales (no tiene encuentro todos los
  // domingos) — la propia pantalla/API ya filtra por campus/rol.
  { key: "fechas-encuentro", label: "Fechas de encuentro", href: "/fechas-encuentro", icon: "turnos", listo: true },
  { key: "visitas", label: "Conexión", href: "/visitas", icon: "visitas", listo: true },
  { key: "perfiles", label: "Perfiles", href: "/perfiles", icon: "perfiles", listo: true },
  { key: "reuniones", label: "Reuniones", href: "/reuniones", icon: "reuniones", listo: true },
  { key: "perfil", label: "Mi perfil", href: "/perfil", icon: "perfil", listo: true },
  { key: "actividad", label: "Actividad", href: "/actividad", icon: "actividad", listo: true },
  // Mismo nombre y lugar que en la Administración de la app vieja —
  // todavía sin pantalla propia (listo:false → aparece gris, "Pronto",
  // en vez de desaparecer, para no perder el mapa del menú real).
  { key: "estadisticas", label: "Estadísticas", href: "/estadisticas", icon: "actividad", listo: true },
  // Aportes de un encuentro (Ofrenda/Diezmo/Siembra/Amor por la Casa por
  // categoría y forma de pago) es una actividad propia, distinta del
  // informe de Finanzas — entra por su propio selector de encuentro/fecha
  // y va directo a /encuentros/[key]/aportes (no pasa por el Reporte).
  { key: "aportes", label: "Aportes", href: "/encuentros/aportes", icon: "aportes", listo: true },
  // Única puerta para Ministro/Administrador a Mi equipo/Asistencia/Fondo
  // de equipo/Conexión/Bajas/Estadísticas/Reporte/Aportes (esFin() los
  // saca del menú normal) — y para Pastor/Pastor de campus, a Turnos/
  // Fondos/Reportes/Fechas de encuentro.
  { key: "administracion", label: "Administración", href: "/administracion", icon: "administracion", listo: true },
];
