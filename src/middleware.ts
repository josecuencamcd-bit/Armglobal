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

  // Code.gs revisaba u.b (bloqueado) en cada api_*; acá el middleware es el
  // único punto de paso obligado, así que el chequeo va aquí — una cuenta
  // recién pedida (pendiente de aprobación) queda bloqueada hasta que un
  // Admin app la apruebe (ver /api/solicitudes-acceso).
  let bloqueado = false;
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("bloqueado").eq("id", user.id).maybeSingle();
    bloqueado = !!perfil?.bloqueado;
    if (bloqueado) await supabase.auth.signOut();
  }
  const hayUsuario = !!user && !bloqueado;

  const esPublica =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/solicitar-acceso") ||
    request.nextUrl.pathname.startsWith("/recuperar") ||
    request.nextUrl.pathname.startsWith("/actualizar-clave") ||
    request.nextUrl.pathname.startsWith("/api/solicitudes-acceso") ||
    request.nextUrl.pathname.startsWith("/api/auth") ||
    request.nextUrl.pathname.startsWith("/api/whatsapp") ||
    request.nextUrl.pathname.startsWith("/api/cron");
  if (!hayUsuario && !esPublica) {
    const url = request.nextUrl.clone();
    if (bloqueado) url.searchParams.set("bloqueado", "1");
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Excluye también los archivos estáticos de /public (logo, íconos,
  // manifest, service worker): antes solo se excluía _next/static,
  // _next/image y favicon.ico, así que esos archivos quedaban atrapados por
  // el middleware y, sin sesión, redirigidos a /login (HTML en vez de la
  // imagen) — el logo del login salía roto y el manifest/íconos del PWA
  // también fallaban, bloqueando la instalación real de la app.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|json|js|txt|xml|woff|woff2)$).*)"],
};
