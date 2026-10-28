import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { AREAS } from "@/lib/sesiones";
import { campusFin } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";

const DIAS_VALIDOS = [7, 15, 30] as const;

function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
}
function restarDias(f: string, n: number) {
  const [y, m, d] = f.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) - n * 86400000).toISOString().slice(0, 10);
}

/**
 * api_ecoEquipoStats: cuántas veces sirvió cada integrante del equipo en los
 * últimos 7/15/30 días (Vino/Avisó/No vino/Sin marcar), contra
 * `integrante_seguimiento` (equivalente a la hoja "Programa"). La ve el
 * líder de su área (solo su equipo) o alguien de finanzas que no sea líder
 * (Pastor/Ministro/Administrador/Admin app ven todas las áreas del campus)
 * — mismo gate que ADMIN_SUBNAV["equipostats"] en Code.gs. Si hay una
 * "vista como X" activa, el gate y el equipo son los de X.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const perfil = identidad.perfil;
  const roles = (perfil.roles as string[] | null) ?? [];
  const areasPerfil = (perfil.areas as string[] | null) ?? [];
  const esLider = roles.includes("Líder");
  const esFinanzas =
    roles.includes("Pastor principal") ||
    roles.includes("Pastor de campus") ||
    roles.includes("Pastor") ||
    roles.includes("Ministro") ||
    roles.includes("Administrador") ||
    roles.includes("Admin app");
  if (!esLider && !esFinanzas) return fail("Tu perfil no tiene acceso a las estadísticas del equipo.", 403);

  const areasVisibles =
    esFinanzas && !esLider ? [...AREAS] : areasPerfil.filter((a) => AREAS.includes(a as (typeof AREAS)[number]));
  if (!areasVisibles.length) return fail("No lideras ningún equipo.", 403);

  const { searchParams } = new URL(req.url);
  const areaParam = searchParams.get("area");
  const area = (areasVisibles.includes(areaParam as (typeof AREAS)[number]) ? areaParam : areasVisibles[0]) as (typeof AREAS)[number];
  const campus = campusFin(perfil.campus ?? null, searchParams.get("campus"));
  const diasParam = Number(searchParams.get("dias"));
  const dias = (DIAS_VALIDOS as readonly number[]).includes(diasParam) ? diasParam : 30;

  const hoy = hoyISO();
  const desde = restarDias(hoy, dias - 1);

  try {
    const { data: miembros, error: eMiembros } = await supabase
      .from("integrantes")
      .select("id, nombre")
      .eq("campus", campus)
      .eq("area", area)
      .neq("estado", "Baja");
    if (eMiembros) throw eMiembros;

    const ids = (miembros ?? []).map((m) => m.id);
    const { data: seg, error: eSeg } = ids.length
      ? await supabase
          .from("integrante_seguimiento")
          .select("integrante_id, fecha, estado")
          .eq("campus", campus)
          .eq("area", area)
          .in("integrante_id", ids)
          .gte("fecha", desde)
          .lte("fecha", hoy)
      : { data: [] as { integrante_id: number; fecha: string; estado: string | null }[], error: null };
    if (eSeg) throw eSeg;

    type Fila = { nombre: string; vino: number; aviso: number; noVino: number; sinMarcar: number; programado: number; pct: number | null };
    const por = new Map<number, Fila>();
    (miembros ?? []).forEach((m) => por.set(m.id, { nombre: m.nombre, vino: 0, aviso: 0, noVino: 0, sinMarcar: 0, programado: 0, pct: null }));

    const fechas = new Set<string>();
    for (const s of seg ?? []) {
      if (s.integrante_id == null) continue;
      const p = por.get(s.integrante_id);
      if (!p) continue;
      fechas.add(s.fecha);
      p.programado++;
      if (s.estado === "Vino") p.vino++;
      else if (s.estado === "Avisó") p.aviso++;
      else if (s.estado === "No vino") p.noVino++;
      else p.sinMarcar++;
    }

    const tot = { vino: 0, aviso: 0, noVino: 0 };
    const lista = [...por.values()].map((p) => {
      const marcados = p.vino + p.aviso + p.noVino;
      tot.vino += p.vino;
      tot.aviso += p.aviso;
      tot.noVino += p.noVino;
      p.pct = marcados ? Math.round((p.vino / marcados) * 100) : null;
      return p;
    });
    lista.sort((a, b) => b.vino - a.vino || (a.nombre < b.nombre ? -1 : 1));

    const marc = tot.vino + tot.aviso + tot.noVino;

    return ok({
      campus,
      area,
      areas: areasVisibles,
      dias,
      desde,
      hasta: hoy,
      encuentros: fechas.size,
      integrantes: (miembros ?? []).length,
      servicios: tot.vino,
      avisaron: tot.aviso,
      faltaron: tot.noVino,
      pct: marc ? Math.round((tot.vino / marc) * 100) : null,
      sinServir: lista.filter((p) => p.vino === 0).length,
      personas: lista,
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
