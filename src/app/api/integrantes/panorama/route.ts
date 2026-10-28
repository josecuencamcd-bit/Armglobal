import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";
import { CAMPUS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";

/**
 * api_ecoPanorama: vista general para Pastor/Admin app de todas las áreas
 * de un campus (cuánta gente, antigüedad, roles de servicio) más visitas y
 * solicitudes de baja pendientes. A diferencia de Code.gs (donde `area` de
 * un integrante podía ser una lista separada por comas, repartida vía
 * areasDe_), acá cada fila de `integrantes` ya tiene un solo `area_t` —
 * no hace falta repartir a una persona en varias áreas.
 */
type Persona = { anosIglesia: number; anosServ: number; rolServ: string };

function resumenAnos(lista: Persona[]) {
  const n = lista.length;
  let si = 0,
    ss = 0;
  const roles: Record<string, number> = {};
  for (const p of lista) {
    si += p.anosIglesia;
    ss += p.anosServ;
    const k = p.rolServ || "Sin definir";
    roles[k] = (roles[k] ?? 0) + 1;
  }
  return {
    total: n,
    promIglesia: n ? Math.round((si / n) * 10) / 10 : 0,
    promServ: n ? Math.round((ss / n) * 10) / 10 : 0,
    roles: Object.entries(roles)
      .map(([rol, n]) => ({ rol, n }))
      .sort((a, b) => b.n - a.n),
  };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);

  const roles = (identidad.perfil.roles as string[] | null) ?? [];
  const esPastor = roles.includes("Pastor principal") || roles.includes("Pastor de campus") || roles.includes("Pastor");
  if (!esPastor && !roles.includes("Admin app")) return fail("Tu perfil no tiene acceso a esta sección.", 403);

  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus")) ?? CAMPUS[0];

  try {
    const [{ data: integrantes, error: e1 }, { data: visitas, error: e2 }, { count: solicitudes, error: e3 }] = await Promise.all([
      supabase.from("integrantes").select("area, anos_iglesia, anos_servicio, rol_servicio").eq("campus", campus).neq("estado", "Baja"),
      supabase.from("visitas").select("estado").eq("campus", campus),
      supabase.from("solicitudes_baja").select("id", { count: "exact", head: true }).eq("campus", campus).eq("estado", "Pendiente"),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const todos: Persona[] = (integrantes ?? []).map((r) => ({
      anosIglesia: Number(r.anos_iglesia) || 0,
      anosServ: Number(r.anos_servicio) || 0,
      rolServ: r.rol_servicio ?? "",
    }));
    const porArea = new Map<string, Persona[]>();
    (integrantes ?? []).forEach((r, i) => {
      const lista = porArea.get(r.area) ?? [];
      lista.push(todos[i]);
      porArea.set(r.area, lista);
    });
    const areas = [...porArea.keys()].sort().map((area) => ({ area, ...resumenAnos(porArea.get(area)!) }));

    const pendientesVisitas = (visitas ?? []).filter((v) => v.estado === "Pendiente").length;

    return ok({
      campus,
      hoy: new Date().toISOString().slice(0, 10),
      total: todos.length,
      anos: resumenAnos(todos),
      areas,
      visitas: { total: (visitas ?? []).length, pendientes: pendientesVisitas },
      solicitudes: solicitudes ?? 0,
    });
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
