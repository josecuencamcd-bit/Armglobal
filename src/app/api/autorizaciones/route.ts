import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { ArgsSchema, CAMPUS, claveSesion } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { avisarAdmins } from "@/lib/email";
import { z } from "zod";

const ROLES_PASTOR = ["Pastor de campus", "Pastor", "Pastor principal"] as const;

/**
 * Equivalente a api_autPedir(): un usuario de Finanzas pide autorización
 * para reabrir un encuentro de un día anterior (mismo día es libre — ver
 * auth_mismo_dia en la migración). La policy autorizaciones_encuentro_insert
 * exige auth_es_finanzas() + que `correo` sea el propio (lo resolvemos acá
 * leyendo perfiles, igual que Code.gs usaba Session.getActiveUser()).
 *
 * Dos pasos — mismo patrón que /api/fondos/autorizaciones: queda
 * "Pendiente Pastor" (pasa a "Pendiente Admin" si el Pastor da el Ok, o
 * directo a "Autorizada" si Soporte/Admin app la resuelve sin esperar al
 * Pastor — ver /api/autorizaciones/[id]). Se avisa por correo al Pastor
 * del campus y, copiado, a Soporte (Admin app).
 */
const PedirSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  encuentro: z.string(),
  evento: z.string().optional().default(""),
  fecha: z.string(),
  motivo: z.string().trim().min(1, "Falta el motivo.").max(300),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, PedirSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const args = ArgsSchema.safeParse(parsedBody.data);
  if (!args.success) return fail("Encuentro no válido.");

  const supabase = await createClient();
  try {
    const identidad = await identidadActuante(supabase);
    if (!identidad) return fail("No autenticado.", 401);
    const perfil = identidad.perfil;

    const { data, error } = await supabase
      .from("autorizaciones_encuentro")
      .insert({
        correo: perfil.correo,
        nombre: perfil.nombre,
        sesion_key: claveSesion(args.data),
        campus: args.data.campus,
        encuentro: args.data.encuentro,
        fecha: args.data.fecha,
        motivo: parsedBody.data.motivo,
        estado: "Pendiente Pastor",
        pedido: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    // El correo se manda después de responder (next/server after) — así un
    // Resend lento o caído nunca retrasa ni cuelga la respuesta al botón
    // "Enviar solicitud" del cliente (la solicitud ya quedó guardada arriba).
    after(async () => {
      try {
        const admin = createAdminClient();
        const [{ data: pastores }, { data: admins }] = await Promise.all([
          admin.from("perfiles").select("correo").overlaps("roles", ROLES_PASTOR as unknown as string[]).or(`campus.eq.${args.data.campus},campus.is.null`),
          admin.from("perfiles").select("correo").contains("roles", ["Admin app"]),
        ]);
        const destinatarios = [...(pastores ?? []), ...(admins ?? [])]
          .map((p) => p.correo)
          .filter((c): c is string => !!c);
        console.log("[autorizaciones] destinatarios:", destinatarios);
        await avisarAdmins({
          destinatarios,
          asunto: `Reabrir encuentro: ${args.data.encuentro} · ${args.data.campus}`,
          titulo: "Pide autorización para modificar un encuentro",
          datos: [
            ["Quién pide", perfil.nombre],
            ["Encuentro", `${args.data.encuentro} · ${args.data.campus}`],
            ["Fecha", args.data.fecha],
            ["Motivo", parsedBody.data.motivo],
          ],
          nota: "Pastor: revísala y da el Ok en Soporte > Reabrir encuentros. Soporte: puedes aprobarla directo si hace falta, sin esperar al Pastor.",
        });
      } catch (eCorreo) {
        // un correo que falla no debe tumbar la solicitud ya guardada
        console.error("[autorizaciones] error enviando aviso:", eCorreo);
      }
    });

    return ok(data, 201);
  } catch (e) {
    return fromSupabaseError(e as { message: string; code?: string });
  }
}

/**
 * Lista las solicitudes visibles para el usuario (RLS: su propio campus).
 * `?sesion_key=` filtra por un encuentro puntual — antes lo hacía el
 * cliente trayendo TODAS las autorizaciones del campus y filtrando en
 * memoria (encuentros/[key]/page.tsx), igual que api_autEstado ya hacía
 * server-side en Code.gs.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sesionKey = searchParams.get("sesion_key");

  const supabase = await createClient();
  let query = supabase.from("autorizaciones_encuentro").select("*").order("pedido", { ascending: false });
  if (sesionKey) query = query.eq("sesion_key", sesionKey);

  const { data, error } = await query;
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
