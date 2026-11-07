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
 * campus — misma noción que usa `administracion_semanal`, para que todo
 * quede agrupado por semana real. */
export function semanaDe(campus: (typeof CAMPUS)[number]): string {
  const primeraFecha = encuentrosSemana(campus)[0]?.fecha;
  return lunesDe(primeraFecha ?? new Date().toISOString().slice(0, 10));
}

/** Une la clave de encuentro de la encuesta de disponibilidad ("Jueves PM")
 * con el nombre de servicio que usa la ficha física en papel y
 * `fichas_servicio.servicio` ("Jueves 8pm") — son la misma reunión, dos
 * nombres distintos en dos partes de la app. Task 4: armar la ficha a partir
 * de quién respondió disponible. */
export const SERVICIO_DE_ENCUENTRO: Record<string, string> = {
  "Jueves PM": "Jueves 8pm",
  "Domingo AM": "Domingo 11am",
  "Domingo PM": "Domingo 6pm",
};

export const ENCUENTRO_DE_SERVICIO: Record<string, string> = Object.fromEntries(
  Object.entries(SERVICIO_DE_ENCUENTRO).map(([enc, serv]) => [serv, enc])
);

/** Ventana en la que la encuesta pública acepta respuestas (pedido de José
 * Miguel): se habilita los viernes a las 8:00 am y se cierra los miércoles
 * a las 8:00 pm — jueves completo y viernes antes de las 8 quedan cerrados.
 * Como `semanaDe`/`encuentrosSemana` siempre calculan la PRÓXIMA fecha de
 * cada encuentro desde hoy, en cuanto abre de nuevo el viernes ya apunta a
 * la fecha nueva, sin arrastrar nada de la ronda anterior — no hace falta
 * ningún borrado ni reseteo aparte. */
function horaPuntaArenas(fecha: Date): { dia: number; hora: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Punta_Arenas",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const diaTexto = partes.find((p) => p.type === "weekday")?.value ?? "Sun";
  const horaTexto = partes.find((p) => p.type === "hour")?.value ?? "0";
  const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dia: DIAS[diaTexto] ?? 0, hora: Number(horaTexto) % 24 };
}

export function encuestaAbierta(ahora: Date = new Date()): boolean {
  const { dia, hora } = horaPuntaArenas(ahora);
  if (dia === 5) return hora >= 8; // viernes desde las 8am
  if (dia === 3) return hora < 20; // miércoles hasta antes de las 8pm
  if (dia === 4) return false; // jueves cerrado todo el día
  return dia === 6 || dia === 0 || dia === 1 || dia === 2; // sáb/dom/lun/mar abiertos
}

export const MENSAJE_ENCUESTA_CERRADA =
  "La encuesta de disponibilidad no está abierta en este momento. Se habilita los viernes a las 8:00 am y se cierra los miércoles a las 8:00 pm.";
