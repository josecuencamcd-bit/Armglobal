import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError } from "@/lib/api-helpers";

type Persona = { id: string; nombre: string; correo: string | null; area: string; perfil: string; campus: string | null };

function sinTilde(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * api_reuDirectorio / reuPersonas_: el directorio de la app vieja no es solo
 * `perfiles` (gente con cuenta) — también incluye a los `Integrantes` del
 * equipo que no tienen acceso a la app, para poder agendar "Café"/"1 a 1"
 * con cualquiera. El cliente nunca recibe el correo real de un integrante
 * sin cuenta por su cuenta: solo el id (`u|correo` o `i|id`), que el
 * servidor resuelve al crear la reunión. Excluye al propio usuario.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);

  const [{ data: perfiles, error: e1 }, { data: integrantes, error: e2 }] = await Promise.all([
    supabase.from("perfiles").select("correo, nombre, campus, roles, areas, sirve, bloqueado"),
    supabase.from("integrantes").select("id, nombre, correo, campus, area, estado"),
  ]);
  if (e1) return fromSupabaseError(e1);
  if (e2) return fromSupabaseError(e2);

  const { data: miPerfil } = await supabase.from("perfiles").select("correo").eq("id", user.id).single<{ correo: string }>();
  const propio = (miPerfil?.correo ?? "").toLowerCase();

  const out: Persona[] = [];
  const vistosCorreo = new Set<string>();
  const vistosNombre = new Set<string>();

  for (const p of perfiles ?? []) {
    if (p.bloqueado) continue;
    vistosNombre.add(sinTilde(p.nombre));
    if (p.correo) vistosCorreo.add(p.correo.toLowerCase());
    const roles = (p.roles as string[] | null) ?? [];
    out.push({
      id: `u|${p.correo}`,
      nombre: p.nombre,
      correo: p.correo,
      area: ((p.areas as string[] | null) ?? (p.sirve as string[] | null) ?? []).join(", "),
      perfil: roles.filter((r) => r !== "Admin app" && r !== "Voluntario").join(", "),
      campus: p.campus,
    });
  }
  for (const r of integrantes ?? []) {
    if (r.estado === "Baja") continue;
    const correo = (r.correo ?? "").trim().toLowerCase();
    const nombreNorm = sinTilde(r.nombre);
    if ((correo && vistosCorreo.has(correo)) || vistosNombre.has(nombreNorm)) continue;
    vistosNombre.add(nombreNorm);
    if (correo) vistosCorreo.add(correo);
    out.push({ id: `i|${r.id}`, nombre: r.nombre, correo: correo || null, area: r.area ?? "", perfil: "", campus: r.campus });
  }

  const filtrado = out.filter((p) => (p.correo ?? "").toLowerCase() !== propio);
  filtrado.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return ok(filtrado);
}
