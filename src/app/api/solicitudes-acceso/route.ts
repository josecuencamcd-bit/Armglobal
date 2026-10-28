import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { avisarAdmins } from "@/lib/email";
import { z } from "zod";

/**
 * Equivalente a api_solicitarAcceso (anónimo, antes de tener cuenta) y
 * api_accesos (lista para Admin app).
 *
 * Diferencia real con Code.gs: ahí la clave elegida al pedir el acceso se
 * guardaba hasheada (`huella`) y quedaba "en espera" en la hoja Accesos —
 * recién se copiaba a la hoja de Usuarios cuando el admin aprobaba. Acá no
 * hay manera de preparar una cuenta de Supabase Auth "a medio crear": se
 * crea la cuenta YA (con esa clave) pero bloqueada (`perfiles.bloqueado`),
 * y aprobar solo la desbloquea — rechazar borra la cuenta entera. El
 * middleware ahora corta a cualquier bloqueado en cada request (ver
 * src/middleware.ts), así que estar "pendiente" no da ningún acceso real.
 */
const SolicitarSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo no válido."),
  nombre: z.string().trim().max(120),
  nota: z.string().trim().max(300).optional(),
  clave: z.string().min(6, "La clave debe tener al menos 6 caracteres.").max(40),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, SolicitarSchema);
  if ("error" in parsedBody) return parsedBody.error;
  const { correo, nombre, nota, clave } = parsedBody.data;

  const admin = createAdminClient();

  const { data: yaPerfil } = await admin.from("perfiles").select("id").eq("correo", correo).maybeSingle();
  if (yaPerfil) return fail("Ese correo ya tiene acceso. Entra con tu clave.");

  const { data: yaSolicitud } = await admin
    .from("solicitudes_acceso")
    .select("estado")
    .eq("correo", correo)
    .maybeSingle();
  if (yaSolicitud?.estado === "Pendiente") return fail("Ya enviaste tu solicitud. Espera la aprobación del administrador.");

  const { data: nuevo, error: errAuth } = await admin.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
  });
  if (errAuth || !nuevo?.user) return fail(errAuth?.message ?? "No se pudo crear la cuenta.");

  const { error: errPerfil } = await admin.from("perfiles").insert({
    id: nuevo.user.id,
    correo,
    nombre,
    bloqueado: true,
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(nuevo.user.id);
    return fromSupabaseError(errPerfil);
  }

  const { error: errSolicitud } = await admin
    .from("solicitudes_acceso")
    .upsert({ correo, nombre, nota, estado: "Pendiente", resuelto_por: null, resuelto_en: null }, { onConflict: "correo" });
  if (errSolicitud) return fromSupabaseError(errSolicitud);

  const { data: admins } = await admin.from("perfiles").select("correo").contains("roles", ["Admin app"]);
  try {
    await avisarAdmins({
      destinatarios: (admins ?? []).map((a) => a.correo),
      asunto: `Nueva solicitud de acceso: ${nombre}`,
      titulo: "Solicitud de acceso a la app",
      datos: [
        ["Quién", nombre],
        ["Correo", correo],
        ["Nota", nota ?? ""],
      ],
      nota: "Elige su perfil (rol, equipo y campus) y apruébala en Soporte > Accesos.",
    });
  } catch {
    // no bloqueamos la solicitud por un fallo de envío
  }

  return ok({ pendiente: true }, 201);
}

/** Gate: Admin app (RLS: solicitudes_acceso_admin). */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes_acceso")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) return fromSupabaseError(error);
  return ok(data ?? []);
}
