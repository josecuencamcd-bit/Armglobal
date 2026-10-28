import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS, METODOS_FONDO, CATEG_GASTO } from "@/lib/sesiones";
import { subirFotoJpeg } from "@/lib/fotos";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

const AREAS_FONDO = [...AREAS, "Campus"] as const;

/**
 * "Fondo de equipo" (= hoja "Fondo Voluntariado", que pese al nombre guarda
 * movimientos de TODAS las áreas vía su columna `area`, incluyendo "Campus"
 * para los aportes extraordinarios que registra el Pastor — api_finAporte
 * en Code.gs no tiene tabla propia, reusa esta misma vía regFondo_).
 *
 * `tipo` es 'aporte' | 'gasto' en minúscula (confirmado en regFondo_ de
 * Code.gs) — NO "Ingreso"/"Gasto", que era un valor inventado sin verificar
 * contra el original.
 */
const AporteSchema = z.object({
  tipo: z.literal("aporte"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  area: z.enum(AREAS_FONDO, { error: () => "Área no válida." }),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  nombre: z.string().trim().min(3, "Escribe el nombre de quien aporta.").max(60),
  metodo: z.enum(METODOS_FONDO, { error: () => "Elige si fue en efectivo o por transferencia." }),
  descripcion: z.string().trim().max(120).optional(),
  foto: z.string().optional(),
  motivo: z.string().trim().max(300).optional(),
});

const GastoSchema = z.object({
  tipo: z.literal("gasto"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  comercio: z.string().trim().min(2, "Escribe el comercio o lugar de la compra.").max(80),
  boleta: z.string().trim().min(1, "Escribe el número de boleta (o S/B si no tiene).").max(30),
  categoria: z.enum(CATEG_GASTO, { error: () => "Elige la categoría del gasto." }),
  descripcion: z.string().trim().min(5, "Cuenta en qué se gastó.").max(200),
  foto: z.string().optional(),
  motivo: z.string().trim().max(300).optional(),
});

const RegistrarSchema = z.discriminatedUnion("tipo", [AporteSchema, GastoSchema]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campusParam = searchParams.get("campus");
  const areaParam = searchParams.get("area");
  const campus = CAMPUS.find((c) => c === campusParam);
  const area = AREAS_FONDO.find((a) => a === areaParam);

  const supabase = await createClient();
  let query = supabase.from("fondos_equipo").select("*").order("fecha", { ascending: false });
  if (campus) query = query.eq("campus", campus);
  if (area) query = query.eq("area", area);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}

/**
 * api_fonRegistrar (área de equipo) y api_finAporte (área="Campus",
 * tipo="aporte", solo Pastor — reforzado acá además de en RLS porque la
 * policy deja entrar a cualquier rol de Finanzas, pero Code.gs exige
 * específicamente Pastor para el aporte extraordinario de campus).
 */
export async function POST(req: Request) {
  const parsedBody = await parseBody(req, RegistrarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const perfil = identidad.perfil;

  if (parsedBody.data.area === "Campus") {
    const roles = (perfil.roles as string[] | null) ?? [];
    if (!roles.includes("Pastor principal") && !roles.includes("Pastor de campus") && !roles.includes("Pastor")) {
      return fail("Solo el Pastor registra aportes extraordinarios del campus.", 403);
    }
  }

  const diasDesdeFecha = Math.floor(
    (Date.now() - new Date(`${parsedBody.data.fecha}T00:00:00Z`).getTime()) / 86_400_000
  );

  const { foto, ...resto } = parsedBody.data;
  let foto_url: string | null = null;
  try {
    if (foto) {
      foto_url = await subirFotoJpeg(foto, "fondos", `Fondo ${resto.area} - ${resto.campus} - ${resto.tipo} - ${Date.now()}.jpg`);
    }
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }

  const { data, error } = await supabase
    .from("fondos_equipo")
    .insert({
      ...resto,
      foto_url,
      estado: "Activo",
      por: perfil.correo,
      tardio: diasDesdeFecha > 7,
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
