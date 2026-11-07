import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { esFin } from "@/lib/visibilidad-modulos";
import { z } from "zod";

/**
 * CRUD de "integrantes" (= hoja "Programa"). RLS decide quién ve/escribe
 * qué según campus + área (integrantes_select/integrantes_rw/integrantes_update):
 * Finanzas ve todo su campus; un líder/voluntario de área solo ve/edita la
 * suya; "auth_sirve()" además deja ver (no editar) integrantes del área a
 * la que uno mismo sirve.
 */
const IntegranteSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
  telefono: z.string().trim().max(30).optional(),
  correo: z.string().trim().email("Correo no válido.").optional().or(z.literal("")),
  nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  anos_iglesia: z.number().int().min(0).max(120).optional(),
  anos_servicio: z.number().int().min(0).max(120).optional(),
  rol_servicio: z.string().trim().max(60).optional(),
  profesion: z.string().trim().max(120).optional(),
  estado: z.string().trim().max(40).default("Activo"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus"));
  const area = AREAS.find((a) => a === searchParams.get("area"));

  const supabase = await createClient();

  // Sin área: comportamiento original, acotado por RLS de sesión tal cual
  // (hoy ningún llamador del front pide esto, pero se mantiene por si acaso).
  if (!area) {
    let query = supabase.from("integrantes").select("*").order("nombre", { ascending: true });
    if (campus) query = query.eq("campus", campus);
    const { data, error } = await query;
    if (error) return fromSupabaseError(error);
    return ok((data ?? []).map((i) => ({ ...i, equipos_extra: [] as string[], es_extra: false })));
  }

  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const autorizado =
    esFin(identidad.perfil) || identidad.perfil.areas.includes(area) || identidad.perfil.sirve.includes(area);
  if (!autorizado) return fail("No tienes permiso para ver este equipo.", 403);

  // La lista de "Mi equipo" debe traer tanto a quienes tienen esta área
  // como principal como a quienes la tienen como equipo adicional (Camino
  // 2 + vínculo desde "Agregar integrante" → /equipo-extra) — por eso usa
  // el cliente admin (la RLS de sesión solo deja ver el área principal
  // propia) con el chequeo de permiso ya hecho arriba.
  const admin = createAdminClient();
  let primariaQ = admin.from("integrantes").select("*").eq("area", area);
  if (campus) primariaQ = primariaQ.eq("campus", campus);
  let extraLinksQ = admin.from("integrante_equipos_extra").select("integrante_id").eq("area", area);
  if (campus) extraLinksQ = extraLinksQ.eq("campus", campus);

  const [{ data: primarios, error: errP }, { data: extraLinks, error: errE }] = await Promise.all([
    primariaQ,
    extraLinksQ,
  ]);
  if (errP) return fromSupabaseError(errP);
  if (errE) return fromSupabaseError(errE);

  const idsExtra = (extraLinks ?? []).map((e) => e.integrante_id);
  let extras: NonNullable<typeof primarios> = [];
  if (idsExtra.length > 0) {
    let extraQ = admin.from("integrantes").select("*").in("id", idsExtra);
    if (campus) extraQ = extraQ.eq("campus", campus);
    const { data, error } = await extraQ;
    if (error) return fromSupabaseError(error);
    extras = data ?? [];
  }

  const combinadosMap = new Map<number, (typeof primarios extends (infer R)[] ? R : never) & { es_extra: boolean }>();
  for (const p of primarios ?? []) combinadosMap.set(p.id, { ...p, es_extra: false });
  for (const e of extras) if (!combinadosMap.has(e.id)) combinadosMap.set(e.id, { ...e, es_extra: true });
  const combinados = [...combinadosMap.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  // Camino 2 (disponibilidad por más de un equipo): adjunta TODOS los
  // equipos adicionales de cada integrante listado, para que "Mi equipo"
  // los muestre y los pueda editar.
  const ids = combinados.map((i) => i.id);
  let porId = new Map<number, string[]>();
  if (ids.length > 0) {
    const { data: extraTodos, error: errExtraTodos } = await admin
      .from("integrante_equipos_extra")
      .select("integrante_id, area")
      .in("integrante_id", ids);
    if (errExtraTodos) return fromSupabaseError(errExtraTodos);
    for (const e of extraTodos ?? []) {
      porId.set(e.integrante_id, [...(porId.get(e.integrante_id) ?? []), e.area]);
    }
  }
  const final = combinados.map((i) => ({ ...i, equipos_extra: porId.get(i.id) ?? [] }));

  return ok(final);
}

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, IntegranteSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  try {
    const identidad = await identidadActuante(supabase);

    const { data, error } = await supabase
      .from("integrantes")
      .insert({ ...parsedBody.data, creado_por: identidad?.perfil.correo ?? null })
      .select()
      .single();
    if (error) throw error;
    return ok(data, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}
