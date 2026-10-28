import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Refresca la sesión de Supabase Auth en cada request (patrón estándar de
 * @supabase/ssr para Next.js App Router) y redirige a /login si no hay
 * sesión — reemplaza el chequeo de token propio que hacía cada api_* de
 * Code.gs vía usuarioDe_(a.tk).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esPublica =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/solicitar-acceso") ||
    request.nextUrl.pathname.startsWith("/recuperar") ||
    request.nextUrl.pathname.startsWith("/actualizar-clave") ||
    request.nextUrl.pathname.startsWith("/api/solicitudes-acceso") ||
    request.nextUrl.pathname.startsWith("/api/whatsapp") ||
    request.nextUrl.pathname.startsWith("/api/cron");
  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
