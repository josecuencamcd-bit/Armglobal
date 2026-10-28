import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

/**
 * Las funciones api_* de Code.gs devolvían siempre {ok, data} o {ok:false,
 * error}. Mantenemos esa misma forma de respuesta para que el frontend que
 * se migre después no tenga que reinventar su manejo de errores.
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(mensaje: string, status = 400) {
  return NextResponse.json({ ok: false, error: mensaje }, { status });
}

/** Traduce errores de Postgres/RLS a un mensaje legible, igual que los
 * throw new Error(...) de Code.gs (ej. "Clave de administrador incorrecta."). */
export function fromSupabaseError(error: { message: string; code?: string }) {
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return fail("No tienes permiso para esta acción.", 403);
  }
  if (error.code === "23505") {
    return fail("Ya existe un registro con esos datos.", 409);
  }
  if (error.code === "23503") {
    return fail("El registro relacionado no existe.", 409);
  }
  return fail(error.message, 400);
}

/** Valida el body JSON contra un schema de zod; replica las validaciones
 * manuales de cada api_* (ej. "Monto inválido.", "Campus no válido."). */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: fail("Body JSON inválido.") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const z = parsed.error as ZodError;
    const primero = z.issues[0];
    return { error: fail(`${primero.path.join(".")}: ${primero.message}`) };
  }
  return { data: parsed.data };
}
