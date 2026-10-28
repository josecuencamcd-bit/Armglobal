import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { AREAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import {
  campusFin,
  mesOk,
  mesAnt,
  pctCambio,
  ingresosCampus,
  fondoResumen,
  totalHistorico,
  tendenciaFondo,
  cierreSimplificado,
} from "@/lib/informe-fondos";

/**
 * api_finInforme: informe mensual de finanzas del campus — ingresos de los
 * encuentros (`aportes`) + aportes extraordinarios del Pastor
 * (`fondos_equipo` area='Campus') + gastos de campus (`gastos_campus`),
 * con saldo arrastrado, comparación vs mes anterior, histórico y
 * tendencia de 6 meses. Gate: verFinanzas_ (Pastor, o módulo "finanzas"/
 * "informe" habilitado — el módulo se chequea vía RLS de `gastos_campus`
 * y `aportes`; acá solo se exige no ser anónimo).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const modulosOn = (perfil.modulos_on as string[] | null) ?? [];
  const esPastor = roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor");
  if (!esPastor && !modulosOn.includes("finanzas") && !modulosOn.includes("informe")) {
    return fail("Tu perfil no tiene acceso a las finanzas del campus.", 403);
  }

  const { searchParams } = new URL(req.url);
  const campus = campusFin(perfil.campus ?? null, searchParams.get("campus"));
  const mes = mesOk(searchParams.get("mes"));
  const mesA = mesAnt(mes);

  try {
    const [ing, ex, gastosRows, fondosAreas, historico, tendencia, cierre, prevIng, prevEx] = await Promise.all([
      ingresosCampus(supabase, campus, mes),
      fondoResumen(supabase, campus, mes, "Campus"),
      supabase.from("gastos_campus").select("*").eq("campus", campus),
      Promise.all(AREAS.map((area) => fondoResumen(supabase, campus, mes, area))),
      totalHistorico(supabase, campus, "Campus"),
      tendenciaFondo(supabase, campus, "Campus", 6),
      cierreSimplificado(supabase, campus, "Campus", mes),
      ingresosCampus(supabase, campus, mesA),
      fondoResumen(supabase, campus, mesA, "Campus"),
    ]);

    if (gastosRows.error) throw gastosRows.error;

    let tg = 0,
      gAntes = 0;
    const porItem: Record<string, number> = {};
    const fechasGastos: string[] = [];
    const gastos = (gastosRows.data ?? [])
      .map((x) => {
        const f = x.fecha.slice(0, 10);
        fechasGastos.push(f);
        const m = Number(x.monto) || 0;
        const anu = x.estado === "Anulado";
        if (f.slice(0, 7) < mes) {
          if (!anu) gAntes += m;
          return null;
        }
        if (f.slice(0, 7) !== mes) return null;
        if (!anu) {
          tg += m;
          porItem[x.item] = (porItem[x.item] ?? 0) + m;
        }
        return {
          id: x.id,
          fecha: f,
          item: x.item,
          monto: m,
          comercio: x.comercio,
          boleta: x.boleta,
          descripcion: x.descripcion,
          foto_url: x.foto_url,
          por: x.por,
          anulado: anu,
          tardio: !!x.tardio,
          motivo: x.motivo ?? "",
          anuladoPor: x.anulado_por ?? "",
          anuladoEn: x.anulado_en ?? "",
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

    const porCategoria: Record<string, number> = { ...ing.porCategoria };
    const porMetodo: Record<string, number> = { ...ing.porMetodo };
    if (ex.ingresos) {
      porCategoria["Aportes extraordinarios"] = ex.ingresos;
      for (const k in ex.porMetodo) if (ex.porMetodo[k]) porMetodo[k] = (porMetodo[k] ?? 0) + ex.porMetodo[k];
    }

    const anterior = ing.antes + ex.anterior - gAntes;
    const totalIng = ing.total + ex.ingresos;
    const prevTotalIng = prevIng.total + prevEx.ingresos;

    const mesesSet = new Set([new Date().toISOString().slice(0, 7), mes]);
    fechasGastos.forEach((f) => mesesSet.add(f.slice(0, 7)));
    ex.aportes.forEach((x) => mesesSet.add(x.fecha.slice(0, 7)));

    return ok({
      hoy: new Date().toISOString().slice(0, 10),
      campus,
      mes,
      meses: [...mesesSet].sort().reverse(),
      ingresos: { total: totalIng, encuentros: ing.total, extraordinarios: ex.ingresos, cuenta: ing.cuenta, porCategoria, porMetodo },
      extras: ex.aportes,
      gastos,
      egresos: tg,
      porItem,
      anterior,
      saldo: anterior + totalIng - tg,
      fondos: fondosAreas.map((f) => ({ area: f.area, ingresos: f.ingresos, egresos: f.egresos, anterior: f.anterior, saldo: f.saldo })),
      puedeEditar: true,
      cierre,
      comparacion: { actual: totalIng, anterior: prevTotalIng, pct: pctCambio(totalIng, prevTotalIng) },
      historico: historico.total,
      cuentaHistorico: historico.cuenta,
      tendencia,
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
