import { createClient } from "@/lib/supabase/server";
import { ok, fail, fromSupabaseError, parseBody } from "@/lib/api-helpers";
import { z } from "zod";

const TIPOS = ["Reunión de equipo", "Reunión 1 a 1", "Café"] as const;

function sinTilde(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Punta_Arenas" }).format(new Date());
}
function restarDias(fechaISO: string, n: number) {
  const [y, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n, 12)).toISOString().slice(0, 10);
}

type Invitado = { n: string; c: string };
type Fila = {
  id: number;
  correo: string;
  organizador: string;
  tipo: string;
  titulo: string | null;
  fecha: string;
  hora: string | null;
  duracion: number | null;
  lugar: string | null;
  notas: string | null;
  invitados: Invitado[] | null;
  estado: string;
};

/** reuFila_: la reunión vista desde el usuario actual — "invitados" se
 * devuelve como lista de nombres (nunca correos), "mia" si la organizó. */
function reuFila(r: Fila, miCorreo: string, hoy: string) {
  const inv = r.invitados ?? [];
  const cancelada = r.estado === "Cancelada";
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    fecha: r.fecha,
    hora: r.hora,
    duracion: r.duracion ?? 60,
    lugar: r.lugar,
    notas: r.notas,
    organizador: r.organizador,
    mia: r.correo.toLowerCase() === miCorreo,
    invitados: inv.map((x) => x.n),
    cancelada,
    pasada: !cancelada && r.fecha < hoy,
  };
}

/**
 * api_reuLista: "se ven las que organicé y a las que me invitaron" — la RLS
 * (reuniones_select) ya trae ambas. Acá se arma lo que antes calculaba el
 * servidor de Apps Script: próximas, historial (últimas 40) y "con quién me
 * he reunido" (últimos 90 días, contando a la otra persona de cada reunión
 * propia o ajena donde participé).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);
  const { data: perfil, error: ePerfil } = await supabase
    .from("perfiles")
    .select("correo, nombre")
    .eq("id", user.id)
    .single<{ correo: string; nombre: string }>();
  if (ePerfil) return fromSupabaseError(ePerfil);

  const hoy = hoyISO();
  const desde = restarDias(hoy, 90);
  const miCorreo = perfil.correo.toLowerCase();

  const { data, error } = await supabase.from("reuniones").select("*").order("fecha", { ascending: true });
  if (error) return fromSupabaseError(error);

  const mias = (data ?? []).map((r) => reuFila(r as Fila, miCorreo, hoy));
  const proximas = mias
    .filter((r) => !r.cancelada && r.fecha >= hoy)
    .sort((a, b) => (a.fecha + (a.hora ?? "")).localeCompare(b.fecha + (b.hora ?? "")));
  const historial = mias
    .filter((r) => r.cancelada || r.fecha < hoy)
    .sort((a, b) => (b.fecha + (b.hora ?? "")).localeCompare(a.fecha + (a.hora ?? "")))
    .slice(0, 40);

  const con = new Map<string, { nombre: string; veces: number; ultima: string }>();
  for (const r of mias) {
    if (r.cancelada || r.fecha < desde || r.fecha >= hoy) continue;
    const gente = r.mia ? r.invitados : [r.organizador];
    for (const n of gente) {
      if (n === perfil.nombre) continue;
      const k = sinTilde(n);
      const c = con.get(k) ?? { nombre: n, veces: 0, ultima: "" };
      c.veces++;
      if (r.fecha > c.ultima) c.ultima = r.fecha;
      con.set(k, c);
    }
  }
  const conQuien = Array.from(con.values()).sort((a, b) => b.veces - a.veces || (a.ultima < b.ultima ? 1 : -1));

  return ok({ hoy, proximas, historial, conQuien, tipos: TIPOS });
}

const ReunionSchema = z.object({
  tipo: z.enum(TIPOS),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida."),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige la hora de la reunión."),
  titulo: z.string().trim().max(80).optional(),
  lugar: z.string().trim().max(80).optional(),
  invitados: z.array(z.string()).min(1, "Elige con quién te vas a reunir.").max(40),
  notas: z.string().trim().max(400).optional(),
  duracion: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90), z.literal(120)]).optional(),
});

/**
 * api_reuCrear: el cliente nunca manda correos, manda los ids del
 * directorio (`u|correo` o `i|id`) y el servidor los resuelve — así el
 * directorio de gente sin cuenta no se filtra por el front. Se replica el
 * título automático por tipo cuando no lo escriben.
 */
export async function POST(req: Request) {
  const parsedBody = await parseBody(req, ReunionSchema);
  if ("error" in parsedBody) return parsedBody.error;
  const { tipo, fecha, hora, titulo, lugar, invitados: ids, notas, duracion } = parsedBody.data;

  const hoy = hoyISO();
  if (fecha < hoy) return fail("Elige una fecha desde hoy en adelante.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado.", 401);
  const { data: perfil, error: ePerfil } = await supabase
    .from("perfiles")
    .select("correo, nombre")
    .eq("id", user.id)
    .single<{ correo: string; nombre: string }>();
  if (ePerfil) return fromSupabaseError(ePerfil);

  const integranteIds = ids.filter((id) => id.startsWith("i|")).map((id) => Number(id.slice(2)));
  const correosDirectos = ids.filter((id) => id.startsWith("u|")).map((id) => id.slice(2));

  const [{ data: porCorreo, error: e1 }, { data: porIntegrante, error: e2 }] = await Promise.all([
    correosDirectos.length
      ? supabase.from("perfiles").select("correo, nombre").in("correo", correosDirectos)
      : Promise.resolve({ data: [] as { correo: string; nombre: string }[], error: null }),
    integranteIds.length
      ? supabase.from("integrantes").select("id, nombre, correo").in("id", integranteIds)
      : Promise.resolve({ data: [] as { id: number; nombre: string; correo: string | null }[], error: null }),
  ]);
  if (e1) return fromSupabaseError(e1);
  if (e2) return fromSupabaseError(e2);

  const vistos = new Set<string>();
  const inv: Invitado[] = [];
  for (const p of porCorreo ?? []) {
    if (p.correo.toLowerCase() === perfil.correo.toLowerCase() || vistos.has(p.correo.toLowerCase())) continue;
    vistos.add(p.correo.toLowerCase());
    inv.push({ n: p.nombre, c: p.correo });
  }
  for (const r of porIntegrante ?? []) {
    const c = (r.correo ?? "").toLowerCase();
    if (c && (c === perfil.correo.toLowerCase() || vistos.has(c))) continue;
    if (c) vistos.add(c);
    inv.push({ n: r.nombre, c: r.correo ?? "" });
  }
  if (!inv.length) return fail("Elige con quién te vas a reunir.");

  const tituloFinal =
    titulo ||
    (tipo === "Café"
      ? `Café con ${inv[0].n.split(" ")[0]}${inv.length > 1 ? " y otros" : ""}`
      : tipo === "Reunión 1 a 1"
        ? `Reunión con ${inv[0].n.split(" ")[0]}`
        : "Reunión de equipo");

  const { data, error } = await supabase
    .from("reuniones")
    .insert({
      correo: perfil.correo,
      organizador: perfil.nombre,
      tipo,
      titulo: tituloFinal,
      fecha,
      hora,
      duracion: duracion ?? 60,
      lugar,
      invitados: inv,
      notas,
      estado: "Agendada",
    })
    .select()
    .single();
  if (error) return fromSupabaseError(error);
  return ok(data, 201);
}
