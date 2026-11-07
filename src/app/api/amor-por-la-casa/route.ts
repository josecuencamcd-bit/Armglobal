import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, METODOS, hoy } from "@/lib/sesiones";
import { campusFin } from "@/lib/informe-fondos";
import { identidadActuante } from "@/lib/identidad";
import { esFin, type PerfilVisibilidad } from "@/lib/visibilidad-modulos";
import { z } from "zod";

/**
 * "Amor por la Casa" es un aporte anual (una vez al año), no uno más de
 * los que se registran por encuentro — por eso vive en su propia pantalla
 * y su propio endpoint, separado del Reporte/Aportes de un encuentro
 * puntual. Sigue guardándose en la tabla `aportes` (misma RLS: cualquiera
 * con auth_es_finanzas() para su campus), pero con sesion_key/encuentro/
 * evento en null — no cuelga de ningún encuentro — y categoria fija
 * "Amor por la Casa", que ingresosCampus() excluye del informe mensual a
 * propósito (ver src/lib/informe-fondos.ts).
 */
function aPerfilVisibilidad(p: { roles: unknown; areas: unknown; sirve: unknown; modulos_on: unknown; modulos_off: unknown }): PerfilVisibilidad {
  return {
    roles: (p.roles as PerfilVisibilidad["roles"]) ?? [],
    areas: (p.areas as PerfilVisibilidad["areas"]) ?? [],
    sirve: (p.sirve as PerfilVisibilidad["sirve"]) ?? [],
    modulos_on: (p.modulos_on as string[]) ?? [],
    modulos_off: (p.modulos_off as string[]) ?? [],
  };
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  if (!esFin(aPerfilVisibilidad(identidad.perfil))) return fail("No tienes acceso a Amor por la Casa.", 403);

  const { searchParams } = new URL(req.url);
  const campus = campusFin(identidad.perfil.campus, searchParams.get("campus"));
  const anioParam = searchParams.get("anio");
  const anio = anioParam && /^\d{4}$/.test(anioParam) ? anioParam : hoy().slice(0, 4);

  const { data, error } = await supabase
    .from("aportes")
    .select("id, nombre, monto, metodo, fecha")
    .eq("campus", campus)
    .eq("categoria", "Amor por la Casa")
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`)
    .order("fecha", { ascending: false });
  if (error) return fromSupabaseError(error);

  const total = (data ?? []).reduce((s, a) => s + Number(a.monto), 0);
  return ok({ campus, campusTodos: CAMPUS, anio, entradas: data ?? [], total });
}

const RegistrarSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre.").max(60),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0 && Math.floor(n) <= 100_000_000, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  metodo: z.enum(METODOS, { error: () => "Forma de pago no válida." }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.").optional(),
  campus: z.enum(CAMPUS).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  if (!esFin(aPerfilVisibilidad(identidad.perfil))) return fail("No tienes acceso a Amor por la Casa.", 403);

  const parsedBody = await parseBody(req, RegistrarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const campus = campusFin(identidad.perfil.campus, parsedBody.data.campus ?? null);
  const { data, error } = await supabase
    .from("aportes")
    .insert({
      campus,
      categoria: "Amor por la Casa",
      sesion_key: null,
      encuentro: null,
      evento: null,
      fecha: parsedBody.data.fecha ?? hoy(),
      nombre: parsedBody.data.nombre,
      monto: parsedBody.data.monto,
      metodo: parsedBody.data.metodo,
      registrado_por: identidad.real.correo,
    })
    .select("id, nombre, monto, metodo, fecha")
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  if (!esFin(aPerfilVisibilidad(identidad.perfil))) return fail("No tienes acceso a Amor por la Casa.", 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("Falta el id.");

  const { error, count } = await supabase
    .from("aportes")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("categoria", "Amor por la Casa");
  if (error) return fromSupabaseError(error);
  if (count === 0) return fail("No se encontró ese registro.", 404);
  return ok({ id });
}
