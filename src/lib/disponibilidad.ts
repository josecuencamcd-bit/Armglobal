import { CAMPUS, ENCUENTROS, lunesDe, proximaFecha } from "@/lib/sesiones";
import { FONDO_AREAS } from "@/lib/visibilidad-modulos";

/**
 * Constantes/helpers de la encuesta pública de disponibilidad (Task 3 del
 * pedido de voz de José Miguel). Reusa ENCUENTROS/CAMPUS/lunesDe/
 * proximaFecha de sesiones.ts y FONDO_AREAS (los 6 equipos con fondo propio)
 * en vez de duplicar listas.
 *
 * Modelo de referencia: la encuesta nativa de WhatsApp que el equipo ya usa
 * cada semana ("Disponibilidad de servicio ✨", opciones "Día DD/MM/AA hora
 * [emoji]" + "Sin Disponibilidad 😟"). Acá se replica ese formato para que
 * a la gente no le cambie nada, pero la respuesta cae directo en la app.
 */

export const CAMPUS_DISPONIBILIDAD = CAMPUS;
export const AREAS_DISPONIBILIDAD = FONDO_AREAS;

/** Valor especial guardado en `encuentros` cuando la persona marca que no
 * tiene disponibilidad esta semana — se guarda solo, sin combinarse con
 * encuentros reales, para que el resumen (Task 4) lo cuente aparte. */
export const SIN_DISPONIBILIDAD = "Sin Disponibilidad";

const HORA_ENCUENTRO: Record<string, string> = {
  "Jueves PM": "18:00",
  "Domingo AM": "09:00",
  "Domingo PM": "18:00",
};

const EMOJI_ENCUENTRO: Record<string, string> = {
  "Jueves PM": "🤘",
  "Domingo AM": "✌️",
  "Domingo PM": "🙌",
};

function horaLegible(hhmm: string): string {
  const [h] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? "am" : "pm"}`;
}

function fechaLegible(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export type EncuentroSemana = {
  /** Mismo valor que ENCUENTROS[campus] — se usa como clave al guardar. */
  clave: string;
  fecha: string;
  /** "Jueves 12/11/26 6pm 🤘", igual al formato de la encuesta de WhatsApp. */
  etiqueta: string;
};

/** Encuentros reales de la semana en curso para ese campus, con fecha y
 * etiqueta ya armadas (ver proximaFecha: cada encuentro cae en la próxima
 * ocurrencia de su día desde hoy, así que Jueves/Domingo quedan siempre en
 * la misma semana de calendario). */
export function encuentrosSemana(campus: (typeof CAMPUS)[number]): EncuentroSemana[] {
  return (ENCUENTROS[campus] ?? [])
    .filter((e) => e !== "Evento Especial")
    .map((clave) => {
      const fecha = proximaFecha(clave);
      const dia = clave.startsWith("Jueves") ? "Jueves" : "Domingo";
      const hora = HORA_ENCUENTRO[clave] ?? "18:00";
      const emoji = EMOJI_ENCUENTRO[clave] ?? "🙌";
      return { clave, fecha, etiqueta: `${dia} ${fechaLegible(fecha)} ${horaLegible(hora)} ${emoji}` };
    });
}

/** Semana (lunes ISO) que identifica esta ronda de la encuesta para ese
 * campus — misma noción que usa `turnos`, para que todo quede agrupado por
 * semana real. */
export function semanaDe(campus: (typeof CAMPUS)[number]): string {
  const primeraFecha = encuentrosSemana(campus)[0]?.fecha;
  return lunesDe(primeraFecha ?? new Date().toISOString().slice(0, 10));
}
