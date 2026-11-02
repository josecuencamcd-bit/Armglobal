import { createAdminClient } from "@/lib/supabase/admin";
import { ok, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({ correo: z.string().trim().toLowerCase().email("Correo no válido.") });

/**
 * Reemplaza api_correo de Code.gs: primer paso del login progresivo.
 * Decide qué pantalla sigue para ese correo, igual que lgPasoA("correo") en
 * la app vieja — ahí eran 4 casos (entrar/crear/solicitar/código inicial);
 * acá "crear" (correo pre-autorizado sin clave) no existe: en Supabase
 * Auth no hay forma de tener una cuenta a medias sin clave, así que todo
 * correo sin perfil cae directo en "solicitar" (ver nota en
 * /api/solicitudes-acceso).
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Schema);
  if ("error" in parsed) return parsed.error;
  const correo = parsed.data.correo;
  const admin = createAdminClient();

  const { data: perfil } = await admin.from("perfiles").select("bloqueado").eq("correo", correo).maybeSingle();
  if (perfil) {
    if (perfil.bloqueado) return ok({ estado: "pendiente" as const });
    return ok({ estado: "entrar" as const });
  }

  const { data: solicitud } = await admin
    .from("solicitudes_acceso")
    .select("estado")
    .eq("correo", correo)
    .maybeSingle();
  if (solicitud?.estado === "Pendiente") return ok({ estado: "pendiente" as const });

  return ok({ estado: "solicitar" as const });
}
