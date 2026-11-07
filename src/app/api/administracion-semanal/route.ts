import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { CAMPUS, lunesDe } from "@/lib/sesiones";
import { identidadActuante } from "@/lib/identidad";
import { z } from "zod";

function sumaDias(fechaISO: string, n: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
/** semanasDelMes_: lunes de cada semana que toca ese mes (la primera y la
 * última pueden empezar en el mes anterior o seguir en el siguiente). */
function semanasDelMes(mes: string): string[] {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vistos = new Set<string>();
  const out: string[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const f = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const l = lunesDe(f);
    if (!vistos.has(l)) { vistos.add(l); out.push(l); }
  }
  return out;
}

/**
 * Calendario mensual de quién administra cada campus semana a semana —
 * decide a quién le llega la alerta de encuentro pendiente, y alimenta el
 * recuadro "Administradores de Campus" de la ficha de servicio.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
  const mesParam = searchParams.get("mes");
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hoyISO.slice(0, 7);
  const campus = CAMPUS.find((c) => c === searchParams.get("campus")) ?? CAMPUS[0];

  const supabase = await createClient();
  const [{ data: administracion, error: e1 }, { data: perfiles, error: e2 }] = await Promise.all([
    supabase.from("administracion_semanal").select("*").eq("campus", campus),
    // Mismo alcance que /api/reuniones/directorio: RLS decide qué perfiles
    // ve este usuario (su propio campus, o todos si su rol lo permite).
    supabase.from("perfiles").select("correo, nombre, bloqueado").eq("bloqueado", false),
  ]);
  if (e1) return fromSupabaseError(e1);
  if (e2) return fromSupabaseError(e2);

  const mapa = new Map((administracion ?? []).map((t) => [t.semana, t]));
  const personas = (perfiles ?? [])
    .map((p) => ({ correo: p.correo, nombre: p.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const semanas = semanasDelMes(mes).map((s) => {
    const t = mapa.get(s);
    return { semana: s, hasta: sumaDias(s, 6), correos: t?.correos ?? [], nombres: t?.nombres ?? [] };
  });

  return ok({ mes, campus, campusTodos: CAMPUS, personas, semanas });
}

const GuardarSchema = z.object({
  semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Semana no válida."),
  campus: z.enum(CAMPUS),
  nombres: z.array(z.string()).optional(),
  correos: z.array(z.string().email()).optional(),
});

export async function POST(req: Request) {
  const parsedBody = await parseBody(req, GuardarSchema);
  if ("error" in parsedBody) return parsedBody.error;

  const supabase = await createClient();
  const identidad = await identidadActuante(supabase);
  const semana = lunesDe(parsedBody.data.semana);

  const { data, error } = await supabase
    .from("administracion_semanal")
    .upsert({
      ...parsedBody.data,
      semana,
      por: identidad?.perfil.correo ?? null,
      actualizado: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
