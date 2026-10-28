/** Menú de módulos de la app, compartido entre el nav inferior y /inicio —
 * mismo set que el HTML embebido de Code.gs. `listo:false` = todavía no
 * migrado a Supabase (aparece marcado "Pronto", sin link). */
export type Modulo = { key: string; label: string; href: string; icon: string; listo: boolean };

export const MODULOS: Modulo[] = [
  { key: "inicio", label: "Inicio", href: "/inicio", icon: "🏠", listo: true },
  { key: "encuentros", label: "Encuentros", href: "/encuentros", icon: "🤝", listo: true },
  { key: "aportes", label: "Aportes", href: "/aportes", icon: "💰", listo: false },
  { key: "fondos", label: "Fondos", href: "/fondos", icon: "🏦", listo: false },
  { key: "finanzas", label: "Finanzas", href: "/finanzas", icon: "📊", listo: false },
  { key: "equipos", label: "Equipos", href: "/equipos", icon: "👥", listo: false },
  { key: "turnos", label: "Turnos", href: "/turnos", icon: "🗓️", listo: false },
  { key: "visitas", label: "Visitas", href: "/visitas", icon: "📍", listo: false },
  { key: "cumpleanos", label: "Cumpleaños", href: "/cumpleanos", icon: "🎁", listo: false },
  { key: "perfiles", label: "Perfiles", href: "/perfiles", icon: "🪪", listo: false },
  { key: "reuniones", label: "Reuniones", href: "/reuniones", icon: "📋", listo: false },
];
