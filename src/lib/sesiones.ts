import { z } from "zod";

/**
 * Puerto 1:1 de las constantes y validaciones de Code.gs que necesita el
 * módulo de Encuentros/Aportes (antes args_(), crearSesion_(), api_setCampo).
 * Mantenemos los mismos textos de error para que, si algún día se reusa un
 * frontend que ya los conoce, no haya que retraducir nada.
 */
export const CAMPUS = ["Punta Arenas", "Puerto Natales"] as const;
/** Mismo enum `area_t` que en Postgres — usado por integrantes, fondos_equipo, etc.
 * "Merch" y "Amor por la Casa" habilitados como equipo propio (perfil,
 * integrantes, ficha) — si no se usan en una semana, quedan vacíos en la
 * ficha, igual que cualquier otra área. El módulo de inventario/tallas de
 * Merch sigue pendiente aparte. */
export const AREAS = [
  "Kids", "Tweens", "Técnica", "Worship", "Conexión", "Voluntariado",
  "Stand de Oración", "Merch", "Amor por la Casa",
] as const;
export const ENCUENTROS: Record<string, string[]> = {
  "Punta Arenas": ["Jueves PM", "Domingo AM", "Domingo PM", "Evento Especial"],
  "Puerto Natales": ["Domingo AM"],
};
export const EVENTOS = [
  "Encuentro de Matrimonios",
  "Encuentro de Mujeres",
  "Encuentro de Hombres",
  "Encuentro de Jóvenes",
];
export const MODALIDADES = ["Presencial", "Virtual"] as const;
// Se mantiene el enum completo (coincide con categoria_aporte_t en Postgres
// y con datos históricos) para que lo que ya lee los 4 valores siga
// funcionando. "Amor por la Casa" pasó a ser anual, no por encuentro, así
// que el formulario de Aportes de un encuentro usa CATEGORIAS_ENCUENTRO
// (sin ella) — ver /amor-por-la-casa para su propio registro y total.
export const CATEGORIAS = ["Ofrenda", "Siembra Especial", "Diezmo", "Amor por la Casa"] as const;
export const CATEGORIAS_ENCUENTRO = ["Ofrenda", "Siembra Especial", "Diezmo"] as const;
export const METODOS = ["Tarjeta", "Efectivo", "Transferencia"] as const;
/** Fondos de equipo (Fondo Voluntariado) y gastos de campus — mismos enums de Code.gs. */
export const METODOS_FONDO = ["Efectivo", "Transferencia"] as const;
export const CATEG_GASTO = [
  "Insumos mensuales", "Alimentación", "Transporte", "Actividad especial", "Gastos mensuales", "Otros",
] as const;
export const CATEG_LIBRE = ["Gastos mensuales", "Otros"];
export const GASTOS_ITEMS = ["Luz", "Gas", "Agua", "Alquiler", "Otros"] as const;
export const ASIS_IDS = ["auditorio", "kids", "tweens", "bebes", "papas", "sensorial"];
export const VOL_IDS = [
  "servicio", "tecnica", "kids", "tweens", "worship", "cocina", "rrss",
  "seguridad", "salabebes", "conexion", "oracion", "merch", "amor", "sensorial",
];
/** DIA[encuentro] = día de semana ISO-ish (0=domingo, 4=jueves), igual que Code.gs */
export const DIA: Record<string, number> = { "Jueves PM": 4, "Domingo AM": 0, "Domingo PM": 0 };

export const CAMBIO_ROLES = "2026-11-15";
const EQUIPOS_ANT = [
  "Pedro y Jennifer", "Min. Newman y Min. Emily", "Cristian y Aline", "José Miguel y Ana Gabriela",
];
const EQUIPOS_NUEVOS = [
  "Min. Pedro - Min. Jennifer", "Pas. Newman - Pas. Emily", "Min. Cristian - Min. Aline",
  "Min. José Miguel - Min. Ana Gabriela",
];
export const EQUIPOS = [...EQUIPOS_ANT, ...EQUIPOS_NUEVOS.filter((x) => !EQUIPOS_ANT.includes(x))];

export function hoy(): string {
  // América/Punta_Arenas, igual que TZ en Code.gs. Intl.DateTimeFormat con
  // timeZone evita arrastrar husos del servidor de Vercel (que corre en UTC).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
}

/** Próxima fecha (hoy o en adelante) cuyo día de semana coincide con
 * DIA[encuentro]. Si el encuentro no tiene día fijo (p. ej. "Evento
 * Especial"), devuelve hoy() tal cual. El selector de /encuentros la usa
 * para no ofrecer por defecto una combinación tipo+fecha que la validación
 * de ArgsSchema va a rechazar (ver `DIA` y el superRefine más abajo). */
export function proximaFecha(encuentro: string): string {
  const diaEsperado = DIA[encuentro];
  if (diaEsperado === undefined) return hoy();
  const base = new Date(`${hoy()}T12:00:00Z`);
  const delta = (diaEsperado - base.getUTCDay() + 7) % 7;
  base.setUTCDate(base.getUTCDate() + delta);
  return base.toISOString().slice(0, 10);
}

export function equiposVigentes(): string[] {
  return hoy() >= CAMBIO_ROLES ? EQUIPOS_NUEVOS : EQUIPOS_ANT;
}

/** lunesDe_: lunes ISO de la semana que contiene esa fecha — misma semana
 * que usa la tabla `administracion_semanal` (ver /api/administracion-semanal).
 * Compartida acá para que sesiones-db.ts pueda ubicar a los administradores
 * de la semana de un encuentro sin duplicar la lógica. */
export function lunesDe(fechaISO: string): string {
  const [y, m, d] = fechaISO.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.");

export const ArgsSchema = z
  .object({
    campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
    encuentro: z.string(),
    evento: z.string().optional().default(""),
    fecha: fechaISO,
  })
  .superRefine((a, ctx) => {
    if (!ENCUENTROS[a.campus]?.includes(a.encuentro)) {
      ctx.addIssue({ code: "custom", message: "Encuentro no válido.", path: ["encuentro"] });
      return;
    }
    if (a.encuentro === "Evento Especial" && a.evento && !EVENTOS.includes(a.evento)) {
      ctx.addIssue({ code: "custom", message: "Evento no válido.", path: ["evento"] });
    }
    const d = new Date(`${a.fecha}T12:00:00Z`);
    const diaEsperado = DIA[a.encuentro];
    if (diaEsperado !== undefined && d.getUTCDay() !== diaEsperado) {
      ctx.addIssue({
        code: "custom",
        message: "Esa fecha no corresponde al día de este encuentro.",
        path: ["fecha"],
      });
    }
  });

export type ArgsEncuentro = z.infer<typeof ArgsSchema>;

/** Misma clave que Code.gs: campus|encuentro|evento|fecha */
export function claveSesion(a: ArgsEncuentro): string {
  return [a.campus, a.encuentro, a.evento ?? "", a.fecha].join("|");
}

/** Solo la usa /api/sesiones/[key]/aportes (aportes de un encuentro
 * puntual) — por eso categoria queda acotada a CATEGORIAS_ENCUENTRO: "Amor
 * por la Casa" ya no se registra por encuentro, tiene su propia pantalla
 * (/amor-por-la-casa) con su propio endpoint y su propia validación. */
export const AporteSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre.").max(60),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0 && Math.floor(n) <= 100_000_000, {
      message: "Monto no válido.",
    })
    .transform((n) => Math.floor(n)),
  categoria: z.enum(CATEGORIAS_ENCUENTRO, { error: () => "Categoría no válida." }),
  metodo: z.enum(METODOS, { error: () => "Forma de pago no válida." }),
});

/** Forma cruda del body de setCampo; el valor de cada campo se valida aparte
 * en la ruta (ver validarCampo) porque Code.gs acepta claves dinámicas
 * (asis_<id>, vol_<id>) que un discriminatedUnion de zod no expresa bien. */
export const SetCampoBodySchema = z.object({
  campo: z.string().min(1),
  valor: z.union([z.string(), z.number()]),
});

/** Replica el switch de api_setCampo(): valida `valor` según `campo` y
 * devuelve el valor normalizado a guardar, o lanza con el mismo mensaje. */
export function validarCampo(campo: string, valor: string | number): string | number {
  if (campo === "responsable") {
    // Antes solo aceptaba una de las 4 parejas fijas de EQUIPOS. Ahora el
    // valor puede venir de los administradores asignados en Administración
    // semanal esa semana (uno o varios nombres reales, unidos con " y "), así que se
    // valida como texto libre — igual que predicador/mensaje — en vez de
    // contra esa lista cerrada.
    const v = String(valor ?? "").trim().slice(0, 200);
    if (!v) throw new Error("Responsable no válido.");
    return v;
  }
  if (campo === "modalidad") {
    if (!MODALIDADES.includes(String(valor) as (typeof MODALIDADES)[number])) {
      throw new Error("Modalidad no válida.");
    }
    return String(valor);
  }
  if (campo === "adm") {
    const v = String(valor ?? "");
    if (v && !EQUIPOS.includes(v)) throw new Error("Adm. de Campus no válido.");
    return v;
  }
  if (["predicador", "mensaje", "lideres"].includes(campo)) {
    return String(valor ?? "").slice(0, 120);
  }
  if (["aceptaron", "onAcepto", "onEspect"].includes(campo)) {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (campo.startsWith("asis_") && ASIS_IDS.includes(campo.slice(5))) {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  if (campo.startsWith("vol_") && VOL_IDS.includes(campo.slice(4))) {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  throw new Error("Campo no válido.");
}
