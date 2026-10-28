"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/** Cliente de Supabase para Client Components (navegador). Reemplaza el
 * login propio de Code.gs (api_login/api_registrar/api_olvide/api_restablecer)
 * por los métodos nativos de Supabase Auth. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
