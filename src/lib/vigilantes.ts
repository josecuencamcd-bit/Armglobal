import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CAMPUS, ENCUENTROS, DIA, AREAS, hoy } from "./sesiones";

type DB = SupabaseClient<Database>;

/** REC_ENC_ de Code.gs: minuto del día (hora límite para enviar el reporte)
 * desde el que se avisa si el encuentro/área sigue sin cerrarse. */
const REC_ENC: Record<string, number> = {
  "Domingo AM": 14 * 60,
  "Domingo PM": 20 * 60 + 45,
  "Jueves PM": 21 * 60 + 45,
};

function sumaDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias, 12));
  return dt.toISOString().slice(0, 10);
}

function minutosDelDia(): number {
  const ahora = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Punta_Arenas",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(ahora.find((p) => p.type === "hour")?.value ?? "0");
  const min = Number(ahora.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + min;
}

export interface EncuentroVencido {
  campus: (typeof CAMPUS)[number];
  encuentro: string;
  fecha: string;
  hoy: boolean;
}

/**
 * Encuentros recurrentes cuya hora límite de reporte ya pasó: los de hoy (si
 * ya se cumplió el horario) y los de los 2 días anteriores. Puerto Natales
 * con fechas irregulares se filtra aparte (ver fechas_encuentro) — se omite
 * esa excepción acá por simplicidad; Punta Arenas (el caso principal) es
 * fiel 1:1 a `encuentrosVencidos_` de Code.gs.
 */
export function encuentrosVencidos(): EncuentroVencido[] {
  const hoyStr = hoy();
  const out: EncuentroVencido[] = [];
  for (const campus of CAMPUS) {
    for (const tipo of ENCUENTROS[campus] ?? []) {
      if (DIA[tipo] === undefined || REC_ENC[tipo] === undefined) continue;
      for (let off = 0; off <= 2; off++) {
        const f = sumaDias(hoyStr, -off);
        const [y, m, d] = f.split("-").map(Number);
        if (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() !== DIA[tipo]) continue;
        if (off === 0 && minutosDelDia() < REC_ENC[tipo]) continue;
        out.push({ campus, encuentro: tipo, fecha: f, hoy: off === 0 });
      }
    }
  }
  return out;
}

async function encuentroCerrado(db: DB, campus: (typeof CAMPUS)[number], encuentro: string, fecha: string): Promise<boolean> {
  const { data } = await db
    .from("sesiones")
    .select("finalizado")
    .eq("campus", campus)
    .eq("encuentro", encuentro)
    .eq("fecha", fecha)
    .is("evento", null)
    .maybeSingle();
  return !!data?.finalizado;
}

/** Encuentros vencidos cuyo administrador de campus todavía no finalizó. */
export async function encuentrosPendientes(db: DB): Promise<EncuentroVencido[]> {
  const vencidos = encuentrosVencidos();
  const out: EncuentroVencido[] = [];
  for (const e of vencidos) {
    if (!(await encuentroCerrado(db, e.campus, e.encuentro, e.fecha))) out.push(e);
  }
  return out;
}

async function notaFinalizada(db: DB, campus: string, area: string, fecha: string): Promise<boolean> {
  const key = [campus, area, fecha].join("|");
  const { data } = await db.from("notas").select("finalizado").eq("key", key).maybeSingle();
  return !!data?.finalizado;
}

export interface NotaPendiente extends EncuentroVencido {
  area: string;
}

/** Para cada encuentro vencido, qué áreas todavía no cerraron su propia asistencia. */
export async function notasPendientes(db: DB): Promise<NotaPendiente[]> {
  const vencidos = encuentrosVencidos();
  const out: NotaPendiente[] = [];
  for (const e of vencidos) {
    for (const area of AREAS) {
      if (!(await notaFinalizada(db, e.campus, area, e.fecha))) {
        out.push({ ...e, area });
      }
    }
  }
  return out;
}

/** Throttle de avisos repetidos (máx. 3 veces, con al menos 110 min entre
 * cada uno) — misma regla que Code.gs sobre `avisos_vigilante`. Devuelve
 * true si corresponde avisar ahora (y dejó el contador actualizado). */
export async function debeAvisar(
  db: DB,
  tipo: "encuentros" | "notas",
  key: string,
  esHoy: boolean
): Promise<boolean> {
  const { data: reg } = await db.from("avisos_vigilante").select("*").eq("tipo", tipo).eq("key", key).maybeSingle();
  const veces = reg?.veces ?? 0;
  const ultimo = reg?.ultimo ? new Date(reg.ultimo).getTime() : 0;
  const ahora = Date.now();

  if (veces >= 3) return false;
  if (veces === 0 && !esHoy) return false; // no avisar de encuentros pasados que nunca se avisaron
  if (ahora - ultimo < 110 * 60_000) return false;

  if (reg) {
    await db.from("avisos_vigilante").update({ veces: veces + 1, ultimo: new Date(ahora).toISOString() }).eq("tipo", tipo).eq("key", key);
  } else {
    await db.from("avisos_vigilante").insert({ tipo, key, veces: 1, ultimo: new Date(ahora).toISOString() });
  }
  return true;
}
