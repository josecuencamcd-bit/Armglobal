import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { CAMPUS, ENCUENTROS, DIA, AREAS, hoy } from "./sesiones";
import { mesAnt, cierreSimplificado } from "./informe-fondos";
import { avisarAdmins } from "./email";

type DB = SupabaseClient<Database>;
type Campus = (typeof CAMPUS)[number];

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

export function minutosDelDia(): number {
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

const FONDOS_CIERRE = [...AREAS, "Campus"] as const;

/** cierreDesde_: mes desde el que rige el cierre automático — se fija la
 * primera vez que corre y no se vuelve a tocar (no cierra meses de antes
 * de que este sistema existiera). Code.gs lo guardaba en PropertiesService;
 * acá, en `avisos_vigilante` (tipo='config', key='cierre_desde', `ultimo`
 * como el primer día de ese mes). */
async function cierreDesde(db: DB): Promise<string> {
  const { data } = await db.from("avisos_vigilante").select("ultimo").eq("tipo", "config").eq("key", "cierre_desde").maybeSingle();
  if (data?.ultimo) return data.ultimo.slice(0, 7);
  const mes = hoy().slice(0, 7);
  await db.from("avisos_vigilante").upsert({ tipo: "config", key: "cierre_desde", ultimo: `${mes}-01`, veces: 0 });
  return mes;
}

function ultimoDiaMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** mesPorCerrar_: el mes que está por cerrarse ahora (desde 3 días antes de
 * terminar hasta el día 4 del siguiente), o '' si no corresponde avisar. */
async function mesPorCerrar(db: DB, hoyStr: string): Promise<string> {
  const dia = Number(hoyStr.slice(8));
  const act = hoyStr.slice(0, 7);
  const m = dia <= 4 ? mesAnt(act) : ultimoDiaMes(act) - dia <= 2 ? act : "";
  const desde = await cierreDesde(db);
  return m && m >= desde ? m : "";
}

/**
 * vigilanteFondos_: cierra solo el mes anterior cuando ya pasó su ventana
 * (día ≥5), y de ahí hasta que se cierre de verdad, recuerda una vez al día
 * (no por campus/área — un solo aviso agregado, igual que Code.gs) a los
 * líderes de cada fondo sin cerrar y a los pastores de campus. Code.gs
 * mandaba estos avisos por correo (avisoA_); acá van por Resend.
 */
export async function vigilanteFondos(db: DB): Promise<{ meses_cerrados: number; avisos: number }> {
  const resultado = { meses_cerrados: 0, avisos: 0 };
  if (minutosDelDia() < 8 * 60) return resultado;

  const hoyStr = hoy();
  const dia = Number(hoyStr.slice(8));
  const act = hoyStr.slice(0, 7);
  const prev = mesAnt(act);
  const desde = await cierreDesde(db);

  if (dia >= 5 && prev >= desde) {
    for (const campus of CAMPUS) {
      for (const area of FONDOS_CIERRE) {
        const { error, count } = await db
          .from("cierres_mes")
          .upsert({ campus, area, mes: prev, automatico: true, por: "Automático" }, { onConflict: "area,campus,mes", ignoreDuplicates: true, count: "exact" });
        if (!error && count) resultado.meses_cerrados++;
      }
    }
  }

  const mes = await mesPorCerrar(db, hoyStr);
  if (!mes || minutosDelDia() < 9 * 60) return resultado;

  const { data: yaAvisado } = await db.from("avisos_vigilante").select("key").eq("tipo", "fondos-aviso-dia").eq("key", hoyStr).maybeSingle();
  if (yaAvisado) return resultado;
  await db.from("avisos_vigilante").insert({ tipo: "fondos-aviso-dia", key: hoyStr, veces: 1, ultimo: new Date().toISOString() });

  const quedan = mes === act ? `Quedan ${ultimoDiaMes(act) - dia} días para que termine el mes.` : "El mes se cierra solo el día 5.";

  for (const campus of CAMPUS) {
    const abiertos: string[] = [];
    for (const area of FONDOS_CIERRE) {
      const { cerrado } = await cierreSimplificado(db, campus, area, mes);
      if (!cerrado) abiertos.push(area);
    }
    if (!abiertos.length) continue;

    for (const area of abiertos) {
      if (area === "Campus") continue;
      const { data: lideres } = await db
        .from("perfiles")
        .select("correo")
        .overlaps("roles", ["Líder"])
        .overlaps("areas", [area])
        .or(`campus.eq.${campus},campus.is.null`);
      const dest = (lideres ?? []).filter((l) => l.correo).map((l) => l.correo!);
      if (!dest.length) continue;
      try {
        await avisarAdmins({
          destinatarios: dest,
          asunto: `Falta cerrar el mes del fondo de ${area}`,
          titulo: "Cierra el mes de tu fondo",
          datos: [
            ["Fondo", `${area} · Campus ${campus}`],
            ["Mes", mes],
          ],
          nota: `${quedan} Revisa que todos los aportes y gastos estén registrados y cierra el mes en Fondos de equipo.`,
        });
        resultado.avisos++;
      } catch {
        // no bloqueamos el resto de los avisos por un fallo de envío
      }
    }

    const { data: pastores } = await db
      .from("perfiles")
      .select("correo")
      .overlaps("roles", ["Pastor de campus"])
      .or(`campus.eq.${campus},campus.is.null`);
    const destPastores = (pastores ?? []).filter((p) => p.correo).map((p) => p.correo!);
    if (destPastores.length) {
      try {
        await avisarAdmins({
          destinatarios: destPastores,
          asunto: `Meses por cerrar · Campus ${campus}`,
          titulo: "Hay fondos con el mes sin cerrar",
          datos: [
            ["Campus", campus],
            ["Mes", mes],
            ["Fondos abiertos", abiertos.map((a) => (a === "Campus" ? "Finanzas del campus" : a)).join(", ")],
          ],
          nota: quedan,
        });
        resultado.avisos++;
      } catch {
        // idem
      }
    }
  }

  return resultado;
}
