import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fromSupabaseError } from "@/lib/api-helpers";

type Persona = { nombre: string; campus: string | null; area: string; nacimiento: string };

/** api_ecoCumples: próximos cumpleaños de integrantes + perfiles (pastores y
 * administradores no tienen ficha en "Mi equipo", su cumpleaños sale desde
 * Mi perfil / Datos personales). Soporta "todo el año" (?todo=1) o un mes
 * puntual (?mes=1..12, por defecto el actual), igual que en la app vieja. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const sp = req.nextUrl.searchParams;
  const hoy = new Date();
  const mesHoy = hoy.getMonth() + 1;
  const todo = sp.get("todo") === "1";
  let mes = Number(sp.get("mes")) || mesHoy;
  if (mes < 1 || mes > 12) mes = mesHoy;

  const vistos = new Set<string>();
  const personas: Persona[] = [];
  const agregar = (nombre: string | null, campus: string | null, area: string, nacimiento: string | null) => {
    if (!nombre || !nacimiento) return;
    const k = nombre.trim().toLowerCase();
    if (vistos.has(k)) return;
    vistos.add(k);
    personas.push({ nombre, campus, area, nacimiento });
  };

  const { data: integrantes, error: e1 } = await supabase
    .from("integrantes")
    .select("nombre, campus, area, nacimiento")
    .eq("estado", "Activo")
    .not("nacimiento", "is", null);
  if (e1) return fromSupabaseError(e1);
  for (const r of integrantes ?? []) agregar(r.nombre, r.campus, r.area, r.nacimiento);

  const { data: perfiles, error: e2 } = await supabase
    .from("perfiles")
    .select("nombre, campus, roles, nacimiento")
    .not("nacimiento", "is", null);
  if (e2) return fromSupabaseError(e2);
  for (const r of perfiles ?? []) {
    const roles = ((r.roles as string[] | null) ?? []).filter((x) => x !== "Admin app");
    agregar(r.nombre, r.campus, roles.join(", ") || "Liderazgo", r.nacimiento);
  }

  const diaHoy = hoy.getDate();
  const calc = (nacimiento: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
    if (!m) return null;
    const anioNac = +m[1], mesNac = +m[2], diaNac = +m[3];
    const base = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let d = Date.UTC(hoy.getFullYear(), mesNac - 1, diaNac);
    if (d < base) d = Date.UTC(hoy.getFullYear() + 1, mesNac - 1, diaNac);
    const faltan = Math.round((d - base) / 86_400_000);
    const edad = new Date(d).getUTCFullYear() - anioNac;
    return { mes: mesNac, dia: diaNac, edad, faltan };
  };

  const lista = personas
    .map((p) => ({ ...p, c: calc(p.nacimiento) }))
    .filter((p): p is Persona & { c: NonNullable<ReturnType<typeof calc>> } => !!p.c && (todo || p.c.mes === mes))
    .map((p) => ({
      nombre: p.nombre,
      campus: p.campus ?? "Todos",
      area: p.area,
      mes: p.c.mes,
      dia: p.c.dia,
      edad: p.c.edad,
      hoy: p.c.faltan === 0,
      faltan: todo ? p.c.faltan : mes === mesHoy ? p.c.dia - diaHoy : null,
    }))
    .sort((a, b) => (todo ? a.faltan! - b.faltan! : a.dia - b.dia));

  return ok({ hoy: hoy.toISOString().slice(0, 10), mes, mesHoy, todo, lista });
}
