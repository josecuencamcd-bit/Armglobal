import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente con service_role: IGNORA RLS por completo.
 * Uso exclusivo de procesos de servidor que no actúan "como" un usuario:
 *  - el webhook de WhatsApp (doPost en Code.gs) resolviendo una autorización
 *    cuando un pastor responde OK/NO por WhatsApp, sin que haya sesión,
 *  - los vigilantes programados (cumpleVigilante_, vigilanteFondos_,
 *    vigilanteEncuentros_, vigilanteNotas_) corriendo en un cron de Vercel.
 * NUNCA se usa para atender una petición disparada por el navegador del
 * usuario — para eso siempre el cliente de server.ts, ligado a su sesión.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
