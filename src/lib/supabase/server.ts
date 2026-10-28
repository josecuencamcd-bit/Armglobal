import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cliente de Supabase para Route Handlers, ligado a la sesión del usuario
 * que hace la petición (vía cookies). Todas las queries corren CON su JWT,
 * así que las policies de RLS (ver rls_policies.sql) son las que deciden
 * qué puede leer o escribir — no hay checks de rol escritos a mano aquí,
 * a diferencia de los api_* de Code.gs que hacían esPastor_()/tiene_() en
 * cada función.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Se llama desde un Server Component sin permiso de escritura;
            // el middleware ya refresca la sesión, así que se ignora.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem
          }
        },
      },
    }
  );
}
