import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, AREAS, METODOS_FONDO } from "@/lib/sesiones";
import { subirFotoJpeg } from "@/lib/fotos";
import { identidadActuante } from "@/lib/identidad";
import { avisarAdmins } from "@/lib/email";
import { z } from "zod";

/**
 * "Aporte voluntario": cualquiera que SIRVA en un equipo (no solo quien lo
 * lidera) deja registrado un aporte al fondo interno de ESE equipo — para
 * gastos internos del equipo, nada que ver con ofrenda/diezmo/siembra de
 * encuentro (eso es /api/sesiones/[key]/aportes, otra tabla). Todo el
 * trabajo (chequeo de permiso + mes cerrado + insert) lo hace
 * fondos_equipo_registrar_aporte_voluntario() en la base — acá solo se sube
 * la foto (si viene) antes de llamarla. Avisa por correo a la líder del
 * equipo para que lo vea, sin aprobación: queda registrado al tiro.
 */
const Schema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  area: z.enum(AREAS, { error: () => "Área no válida." }),
  monto: z
    .number()
    .refine((n) => Number.isFinite(n) && Math.floor(n) > 0, { message: "Monto no válido." })
    .transform((n) => Math.floor(n)),
  metodo: z.enum(METODOS_FONDO, { error: () => "Elige si fue en efectivo o por transferencia." }),
  descripcion: z.string().trim().max(120).optional(),
  foto: z.string().optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, Schema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  if (!identidad) return fail("No autenticado.", 401);
  const perfil = identidad.perfil;

  const { campus, area, monto, metodo, descripcion, foto } = parsedBody.data;

  let foto_url: string | null = null;
  try {
    if (foto) {
      foto_url = await subirFotoJpeg(foto, "fondos", `Aporte voluntario ${area} - ${campus} - ${Date.now()}.jpg`);
    }
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }

  const { data, error } = await supabase.rpc("fondos_equipo_registrar_aporte_voluntario", {
    p_campus: campus,
    p_area: area,
    p_fecha: new Date().toISOString().slice(0, 10),
    p_monto: monto,
    p_nombre: perfil.nombre,
    p_metodo: metodo,
    // El tipo generado marca estos parámetros como `string` porque la
    // función no les puso default en Postgres, pero sí aceptan NULL en
    // tiempo de ejecución (son columnas nullable) — por eso el cast.
    p_descripcion: (descripcion ?? null) as unknown as string,
    p_foto_url: foto_url as unknown as string,
    p_por: perfil.correo,
  });
  if (error) return fromSupabaseError(error);

  after(async () => {
    try {
      const admin = createAdminClient();
      const { data: lideres } = await admin
        .from("perfiles")
        .select("correo")
        .eq("campus", campus)
        .contains("roles", ["Líder"])
        .contains("areas", [area]);
      const destinatarios = (lideres ?? []).map((l) => l.correo).filter((c): c is string => !!c);
      if (destinatarios.length === 0) return;
      await avisarAdmins({
        destinatarios,
        asunto: `Aporte al fondo de ${area}: ${perfil.nombre}`,
        titulo: "Nuevo aporte de tu equipo",
        datos: [
          ["Quién", perfil.nombre],
          ["Equipo", area],
          ["Monto", `$${monto.toLocaleString("es-CL")}`],
          ["Método", metodo],
          ["Nota", descripcion ?? ""],
        ],
        nota: "Queda registrado en el fondo de tu equipo — revísalo en Fondos.",
      });
    } catch (eCorreo) {
      console.error("[fondos/aporte-voluntario] error enviando aviso:", eCorreo);
    }
  });

  return ok(data, 201);
}
