/** Menú de módulos de la app, compartido entre el nav inferior y /inicio —
 * mismo set que el HTML embebido de Code.gs. `listo:false` = todavía no
 * migrado a Supabase (aparece marcado "Pronto", sin link). */
export type Modulo = { key: string; label: string; href: string; icon: string; listo: boolean };

/** `icon` es la clave del objeto ICONOS (src/lib/iconos.tsx), porteado 1:1
 * del SVG de la app vieja — no emoji. */
export const MODULOS: Modulo[] = [
  { key: "inicio", label: "Inicio", href: "/inicio", icon: "inicio", listo: true },
  { key: "encuentros", label: "Encuentros", href: "/encuentros", icon: "asistencia", listo: true },
  { key: "aportes", label: "Aportes", href: "/aportes", icon: "aportes", listo: false },
  { key: "fondos", label: "Fondos", href: "/fondos", icon: "fondo", listo: false },
  { key: "finanzas", label: "Finanzas", href: "/finanzas", icon: "finanzas", listo: false },
  { key: "equipos", label: "Equipos", href: "/equipos", icon: "equipo", listo: false },
  { key: "turnos", label: "Turnos", href: "/turnos", icon: "turnos", listo: false },
  { key: "visitas", label: "Visitas", href: "/visitas", icon: "visitas", listo: false },
  { key: "cumpleanos", label: "Cumpleaños", href: "/cumpleanos", icon: "cumples", listo: false },
  { key: "perfiles", label: "Perfiles", href: "/perfiles", icon: "perfiles", listo: false },
  { key: "reuniones", label: "Reuniones", href: "/reuniones", icon: "reuniones", listo: false },
];
