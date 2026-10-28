import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/**
 * Bitácora de administración: registra quién hizo qué sobre qué, para que
 * Admin app pueda revisar después (soporte / auditoría) sin necesitar ver
 * en vivo la sesión de nadie — reemplaza el "entrar al perfil de otro y ver
 * en vivo lo que hacía" de la app vieja por un registro que se puede
 * repasar cuando haga falta, sin el riesgo de espiar sesiones ajenas.
 * Nunca debe tumbar la acción principal si falla — por eso siempre se
 * llama con try/catch alrededor, nunca se espera que lance.
 */
export async function registrarBitacora(args: {
  actorCorreo?: string | null;
  actorNombre?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | number | null;
  detalle?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("bitacora").insert({
      actor_correo: args.actorCorreo ?? null,
      actor_nombre: args.actorNombre ?? null,
      accion: args.accion,
      entidad: args.entidad,
      entidad_id: args.entidadId != null ? String(args.entidadId) : null,
      detalle: (args.detalle as Json) ?? null,
    });
  } catch {
    // best-effort: un fallo acá nunca debe romper la acción que se registra
  }
}
