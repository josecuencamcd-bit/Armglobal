import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { hoy } from "./sesiones";
import { avisarAdmins, enviarCumpleanos, APP_URL } from "./email";
import { minutosDelDia } from "./vigilantes";

type DB = SupabaseClient<Database>;

/** CUMPLE_PALETAS_: paleta de color de la tarjeta (fondo/acentos), elegida
 * por semilla — igual que Code.gs. */
const PALETAS = [
  ["#ff5a8a", "#ff9a3c", "#ffd23f", "#d6336c", "#fff3e0"],
  ["#7b2ff7", "#f107a3", "#ff9a8b", "#a21caf", "#fdf2f8"],
  ["#00b4d8", "#48cae4", "#90e0ef", "#0077b6", "#effaff"],
  ["#2ecc71", "#a8e063", "#f9d423", "#1e8e4e", "#f3fbea"],
  ["#ff6a00", "#ee0979", "#ffd200", "#c2410c", "#fff4e8"],
  ["#4361ee", "#7209b7", "#f72585", "#4338ca", "#f3f0ff"],
];

/** CUMPLE_VERSOS_: un versículo por día del año (según diaDelAnio), para que
 * no se repita siempre el mismo. Copiados tal cual de Code.gs. */
const VERSOS = [
  "“Jehová te bendiga, y te guarde; Jehová haga resplandecer su rostro sobre ti, y tenga de ti misericordia.” — Números 6:24-25",
  "“Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.” — Salmo 118:24",
  "“Estando persuadido de esto, que el que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.” — Filipenses 1:6",
  "“Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.” — Jeremías 29:11",
  "“Jehová es mi pastor; nada me faltará.” — Salmo 23:1",
  "“Todo lo puedo en Cristo que me fortalece.” — Filipenses 4:13",
  "“Encomienda a Jehová tu camino, y confía en él; y él hará.” — Salmo 37:5",
  "“Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.” — Josué 1:9",
  "“Confía en Jehová con todo tu corazón, y no te apoyes en tu propia prudencia.” — Proverbios 3:5",
  "“Reconócelo en todos tus caminos, y él enderezará tus veredas.” — Proverbios 3:6",
  "“Los que esperan a Jehová tendrán nuevas fuerzas; levantarán alas como las águilas.” — Isaías 40:31",
  "“No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo; siempre te ayudaré.” — Isaías 41:10",
  "“Jehová es mi luz y mi salvación; ¿de quién temeré?” — Salmo 27:1",
  "“Deléitate asimismo en Jehová, y él te concederá las peticiones de tu corazón.” — Salmo 37:4",
  "“Bueno es Jehová para con los que en él esperan, al alma que le busca.” — Lamentaciones 3:25",
  "“Por la mañana oirás mi voz; por la mañana me presentaré delante de ti, y esperaré.” — Salmo 5:3",
  "“Cuán precioso, oh Dios, es tu misericordia; por eso los hijos de los hombres se amparan bajo la sombra de tus alas.” — Salmo 36:7",
  "“Bendice, alma mía, a Jehová, y bendiga todo mi ser su santo nombre.” — Salmo 103:1",
  "“Dad gracias a Jehová, porque él es bueno; porque para siempre es su misericordia.” — Salmo 107:1",
  "“Alzaré mis ojos a los montes; ¿de dónde vendrá mi socorro? Mi socorro viene de Jehová, que hizo los cielos y la tierra.” — Salmo 121:1-2",
  "“Jehová te guardará de todo mal; él guardará tu alma.” — Salmo 121:7",
  "“Si Jehová no edificare la casa, en vano trabajan los que la edifican.” — Salmo 127:1",
  "“Te alabaré; porque formidables, maravillosas son tus obras; estoy maravillado, y mi alma lo sabe muy bien.” — Salmo 139:14",
  "“Enséñanos de tal modo a contar nuestros días, que traigamos al corazón sabiduría.” — Salmo 90:12",
  "“Sacia de bien tu boca de modo que te rejuvenezcas como el águila.” — Salmo 103:5",
  "“Jehová tu Dios está en medio de ti, poderoso, él salvará; se gozará sobre ti con alegría.” — Sofonías 3:17",
  "“El gozo de Jehová es vuestra fuerza.” — Nehemías 8:10",
  "“Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.” — Romanos 8:28",
  "“Y el Dios de esperanza os llene de todo gozo y paz en el creer, para que abundéis en esperanza por el poder del Espíritu Santo.” — Romanos 15:13",
  "“Estad siempre gozosos. Orad sin cesar. Dad gracias en todo, porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.” — 1 Tesalonicenses 5:16-18",
  "“Mas el fruto del Espíritu es amor, gozo, paz, paciencia, benignidad, bondad, fe, mansedumbre, templanza.” — Gálatas 5:22-23",
  "“Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias.” — Filipenses 4:6",
  "“Regocijaos en el Señor siempre. Otra vez digo: ¡Regocijaos!” — Filipenses 4:4",
  "“Y mi Dios, suplirá todo lo que os falta conforme a sus riquezas en gloria en Cristo Jesús.” — Filipenses 4:19",
  "“Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres.” — Colosenses 3:23",
  "“Sobre todo, vestíos de amor, que es el vínculo perfecto.” — Colosenses 3:14",
  "“Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.” — Juan 3:16",
  "“Yo soy el camino, y la verdad, y la vida; nadie viene al Padre, sino por mí.” — Juan 14:6",
  "“La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da. No se turbe vuestro corazón, ni tenga miedo.” — Juan 14:27",
  "“Yo he venido para que tengan vida, y para que la tengan en abundancia.” — Juan 10:10",
  "“Un mandamiento nuevo os doy: Que os améis unos a otros; como yo os he amado, que también os améis unos a otros.” — Juan 13:34",
  "“Todo lo hizo hermoso en su tiempo.” — Eclesiastés 3:11",
  "“Pero buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.” — Mateo 6:33",
  "“Así alumbre vuestra luz delante de los hombres, para que vean vuestras buenas obras, y glorifiquen a vuestro Padre que está en los cielos.” — Mateo 5:16",
  "“Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.” — Mateo 11:28",
  "“Pedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá.” — Mateo 7:7",
  "“Y he aquí yo estoy con vosotros todos los días, hasta el fin del mundo.” — Mateo 28:20",
  "“Cada uno según el don que ha recibido, ministrelo a los otros, como buenos administradores de la multiforme gracia de Dios.” — 1 Pedro 4:10",
  "“Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros.” — 1 Pedro 5:7",
  "“Bienaventurado el varón que confía en Jehová, y cuya confianza es Jehová.” — Jeremías 17:7",
  "“Clama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas que tú no conoces.” — Jeremías 33:3",
  "“Por la misericordia de Jehová no hemos sido consumidos, porque nunca decayeron sus misericordias. Nuevas son cada mañana; grande es tu fidelidad.” — Lamentaciones 3:22-23",
  "“El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente.” — Salmo 91:1",
  "“Mejor es un día en tus atrios que mil fuera de ellos.” — Salmo 84:10",
  "“Bendito el hombre que confía en Jehová; será como árbol plantado junto a las aguas.” — Jeremías 17:7-8",
  "“Sé fiel hasta la muerte, y yo te daré la corona de la vida.” — Apocalipsis 2:10",
  "“Porque somos hechura suya, creados en Cristo Jesús para buenas obras.” — Efesios 2:10",
  "“Y a Aquel que es poderoso para hacer todas las cosas mucho más abundantemente de lo que pedimos o entendemos, a él sea gloria en la iglesia.” — Efesios 3:20-21",
];

function sinTilde(t: string): string {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function nombreBonito(n: string): string {
  return String(n ?? "")
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (w === w.toLowerCase() && w.length) {
        if (i > 0 && /^(de|del|la|las|los|y|da|di|van|von)$/.test(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }
      return w;
    })
    .join(" ");
}

export function listaY(l: string[]): string {
  return l.length < 2 ? l[0] ?? "" : l.slice(0, -1).join(", ") + " y " + l[l.length - 1];
}

function diaDelAnio(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

export interface PersonaCumple {
  n: string;
  eq: string[];
}

/** cumpleDe_: quién cumple años en una fecha — integrantes activos +
 * cualquier perfil (pastores/admins también tienen `nacimiento`). */
export async function cumpleDe(db: DB, fecha: string): Promise<PersonaCumple[]> {
  const md = fecha.slice(5);
  const vistos = new Set<string>();
  const res: PersonaCumple[] = [];
  const add = (nombre: string | null, nacimiento: string | null, eq: string[]) => {
    if (!nombre || !nacimiento || nacimiento.slice(5) !== md) return;
    const k = sinTilde(nombre);
    if (vistos.has(k)) return;
    vistos.add(k);
    res.push({ n: nombreBonito(nombre), eq });
  };

  const { data: integrantes } = await db.from("integrantes").select("nombre, nacimiento, area").neq("estado", "Baja");
  for (const r of integrantes ?? []) add(r.nombre, r.nacimiento, [r.area]);

  const { data: perfiles } = await db.from("perfiles").select("nombre, nacimiento");
  for (const r of perfiles ?? []) add(r.nombre, r.nacimiento, []);

  return res;
}

/** cumpleTextos_: saludo/mensaje/abrazo/versículo/gracias, variando con la
 * semilla (y el versículo con el día del año). */
export function cumpleTextos(pers: PersonaCumple[], semilla: number, diaAnio: number) {
  const sem = Math.abs(semilla || 0);
  const dia = Math.abs(diaAnio || 0);
  const el = <T,>(arr: T[], k = 0): T => arr[(sem + k) % arr.length];
  const nombres = pers.map((p) => p.n);
  const uno = pers.length === 1;
  const lista = listaY(nombres);
  const sg = uno ? 0 : 1;

  const T1 = [
    "Hola, muy buenos días. ¿Cómo estás?",
    "Hola, ¡buenos días! ¿Cómo amaneciste?",
    "Hola, muy buen día. Esperamos que estés muy bien.",
    "¡Hola! Buenos días, ¿cómo estás hoy?",
  ];
  const T2 = [
    [`Hoy nos bendice mucho celebrar el cumpleaños de ${lista}. ¡Qué bendición!`, `Hoy nos bendice mucho celebrar los cumpleaños de ${lista}. ¡Qué bendición!`],
    [`¡Qué alegría! Hoy celebramos la vida de ${lista} y damos gracias a Dios por ello.`, `¡Qué alegría! Hoy celebramos la vida de ${lista} y damos gracias a Dios por ellos.`],
    [`Hoy es un día muy especial: está de cumpleaños ${lista}. ¡Qué bendición tenerle en nuestra familia!`, `Hoy es un día muy especial: están de cumpleaños ${lista}. ¡Qué bendición tenerles en nuestra familia!`],
    [`Hoy el cielo y nuestra familia ARM celebran el cumpleaños de ${lista}. ¡Qué bendición!`, `Hoy el cielo y nuestra familia ARM celebran los cumpleaños de ${lista}. ¡Qué bendición!`],
  ];
  const T3 = [
    [
      "Lo que Dios está haciendo en tu vida, recíbelo con el abrazo y el cariño de nuestros pastores principales, de nuestros pastores de campus y de todo este gran equipo. Hoy damos gracias a Dios por tu vida.",
      "Lo que Dios está haciendo en sus vidas, recíbanlo con el abrazo y el cariño de nuestros pastores principales, de nuestros pastores de campus y de todo este gran equipo. Hoy damos gracias a Dios por sus vidas.",
    ],
    [
      "Recibe hoy el abrazo y el cariño de nuestros pastores principales, de nuestros pastores de campus y de todo este gran equipo. Damos gracias a Dios por tu vida y por todo lo que está haciendo en ella.",
      "Reciban hoy el abrazo y el cariño de nuestros pastores principales, de nuestros pastores de campus y de todo este gran equipo. Damos gracias a Dios por sus vidas y por todo lo que está haciendo en ellas.",
    ],
    [
      "Nuestros pastores principales, nuestros pastores de campus y todo este gran equipo te abrazan con mucho cariño. Que Dios siga haciendo cosas hermosas en tu vida.",
      "Nuestros pastores principales, nuestros pastores de campus y todo este gran equipo les abrazan con mucho cariño. Que Dios siga haciendo cosas hermosas en sus vidas.",
    ],
  ];
  const GR = [
    (n: string, e: string) => (uno ? `Gracias por tu servicio en el hermoso equipo de ${e}.` : `Gracias a ${n} por su servicio en el hermoso equipo de ${e}.`),
    (n: string, e: string) => (uno ? `Gracias por servir con tanto corazón en el equipo de ${e}.` : `Gracias a ${n} por servir con tanto corazón en el equipo de ${e}.`),
    (n: string, e: string) => (uno ? `Valoramos mucho tu entrega en el equipo de ${e}. ¡Gracias!` : `Valoramos mucho la entrega de ${n} en el equipo de ${e}. ¡Gracias!`),
  ];
  const g = el(GR, 1);

  return {
    saludo: el(T1, 0),
    mensaje: el(T2, 1)[sg],
    abrazo: el(T3, 2)[sg],
    versiculo: VERSOS[dia % VERSOS.length],
    gracias: pers
      .map((p) => (p.eq.length ? g(p.n, listaY(p.eq)) : ""))
      .filter(Boolean)
      .join(" "),
  };
}

type PropuestaFila = {
  id: number;
  fecha: string;
  nombres: string;
  saludo: string | null;
  mensaje: string | null;
  abrazo: string | null;
  gracias: string | null;
  versiculo: string | null;
  semilla: string | null;
};

/** cumpleHtml_: arma el correo desde la propuesta — mismas imágenes (ahora
 * servidas como estáticos de la app, `/cumple/*.png`, en vez de incrustadas
 * en base64 o adjuntas por cid). */
export function cumpleHtml(p: PropuestaFila) {
  const esc = (t: string | null) =>
    String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  const pers: PersonaCumple[] = JSON.parse(p.nombres || "[]");
  const lista = listaY(pers.map((x) => x.n));
  const sem = Math.abs(Number(p.semilla) || 0);
  const pal = PALETAS[sem % PALETAS.length];
  const v = sem % 3;
  const src = (archivo: string) => `${APP_URL}/cumple/${archivo}.png`;
  const im = (archivo: string, w: number) =>
    `<img src="${src(archivo)}" width="${w}" alt="" style="display:block;width:100%;max-width:${w}px;height:auto;border:0">`;

  const html = `<div style="background:${pal[4]};padding:22px 10px;font-family:Arial,Helvetica,sans-serif"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${pal[0]}" style="border-collapse:collapse;background-color:${pal[0]};background-image:linear-gradient(135deg,${pal[0]} 0%,${pal[1]} 55%,${pal[2]} 100%)"><tr>
    <td width="27%" valign="bottom" style="padding:14px 0 0 6px">${im(`t${(v + 1) % 3}`, 150)}</td>
    <td valign="middle" align="center" style="padding:18px 4px"><div style="background:#ffffff;border-radius:20px;padding:12px 6px 14px;text-align:center">${im("ti", 240).replace("display:block;", "display:block;margin:0 auto;")}
    <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:bold;font-size:26px;line-height:1.15;color:${pal[3]};padding:6px 8px 0">${esc(lista)}</div></div></td>
    <td width="27%" valign="top" style="padding:8px 6px 0 0">${im(`g${v}`, 150)}</td></tr></table>
    <div style="padding:26px 28px;color:#2b2b2b;font-size:15px;line-height:1.65"><p style="margin:0 0 14px">${esc(p.saludo)}</p><p style="margin:0 0 14px"><b>${esc(p.mensaje)}</b></p><p style="margin:0 0 14px">${esc(p.abrazo)}</p>
    ${p.gracias ? `<p style="margin:0 0 14px">${esc(p.gracias)} 💛</p>` : ""}
    <p style="font-style:italic;color:#444;background:${pal[4]};border-left:4px solid ${pal[1]};padding:10px 14px;border-radius:6px;margin:18px 0">${esc(p.versiculo)}</p>
    <p style="margin:22px 0 0">Con mucho cariño,<br><b>Tu familia</b> <img src="${src("lg")}" width="66" height="14" alt="armglobal" style="vertical-align:-2px;border:0"> 🙏</p></div>
    <div style="background:#111;color:#bbb;text-align:center;font-size:11px;padding:14px 10px;letter-spacing:1px"><img src="${src("lw")}" width="84" height="18" alt="armglobal" style="vertical-align:middle;border:0"> &nbsp;-&nbsp; CAMPUS PUNTA ARENAS &nbsp;-&nbsp; CAMPUS PUERTO NATALES</div></div></div>`;

  const txt = `🎈 ¡Feliz cumpleaños, ${lista}! 🎂\n\n${p.saludo}\n\n${p.mensaje}\n\n${p.abrazo}${p.gracias ? `\n\n${p.gracias}` : ""}\n\n${p.versiculo}\n\nCon mucho cariño,\nTu familia armglobal`;
  return { html, txt, asunto: `🎂 ¡Hoy celebramos a ${lista}!`, nombres: pers };
}

/** cumpleDestinos_: toda la congregación — perfiles activos (no bloqueados)
 * + integrantes activos con correo válido. */
export async function cumpleDestinos(db: DB): Promise<string[]> {
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const out = new Set<string>();
  const [{ data: perfiles }, { data: integrantes }] = await Promise.all([
    db.from("perfiles").select("correo").eq("bloqueado", false),
    db.from("integrantes").select("correo").eq("estado", "Activo"),
  ]);
  for (const r of perfiles ?? []) if (r.correo && ok.test(r.correo)) out.add(r.correo.toLowerCase());
  for (const r of integrantes ?? []) if (r.correo && ok.test(r.correo)) out.add(r.correo.toLowerCase());
  return [...out];
}

/** cumpleCrear_: crea la propuesta (Pendiente) para una fecha, si no existe
 * ya una no anulada, y avisa a los Admin app para que la revisen. */
export async function cumpleCrear(db: DB, fecha: string): Promise<boolean> {
  const pers = await cumpleDe(db, fecha);
  if (!pers.length) return false;

  const { data: ya } = await db.from("cumple_propuestas").select("id").eq("fecha", fecha).neq("estado", "Anulada").maybeSingle();
  if (ya) return false;

  const sem = diaDelAnio(fecha) + pers.length;
  const t = cumpleTextos(pers, sem, diaDelAnio(fecha));
  const { error } = await db.from("cumple_propuestas").insert({
    fecha,
    nombres: JSON.stringify(pers),
    saludo: t.saludo,
    mensaje: t.mensaje,
    abrazo: t.abrazo,
    gracias: t.gracias,
    versiculo: t.versiculo,
    semilla: String(sem),
    estado: "Pendiente",
  });
  if (error) throw error;

  const lst = listaY(pers.map((p) => p.n));
  const cuando = fecha === hoy() ? "HOY" : `mañana (${fecha.split("-").reverse().join("/")})`;
  const { data: admins } = await db.from("perfiles").select("correo").contains("roles", ["Admin app"]);
  try {
    await avisarAdmins({
      destinatarios: (admins ?? []).map((a) => a.correo).filter(Boolean) as string[],
      asunto: `Propuesta de cumpleaños para aprobar: ${lst}`,
      titulo: "Saludo de cumpleaños por aprobar",
      datos: [
        ["Quién cumple", lst],
        ["Cuándo", cuando],
      ],
      nota: "Revisa el mensaje y apruébalo o edítalo en Soporte > Cumpleaños. Si lo apruebas antes de las 8:00 sale a esa hora; si lo apruebas después, sale al instante.",
    });
  } catch {
    // no bloqueamos la creación por un fallo de envío
  }
  return true;
}

/** cumpleEnviar_: manda el saludo aprobado a toda la congregación y marca
 * la propuesta como Enviada. Devuelve cuántos destinatarios recibieron. */
export async function cumpleEnviar(db: DB, propuesta: PropuestaFila): Promise<number> {
  const dest = await cumpleDestinos(db);
  if (!dest.length) throw new Error("No hay destinatarios disponibles para enviar.");

  const { html, txt, asunto } = cumpleHtml(propuesta);
  const n = await enviarCumpleanos(dest, asunto, html, txt);

  await db
    .from("cumple_propuestas")
    .update({ estado: "Enviada", enviada_en: new Date().toISOString() })
    .eq("id", propuesta.id);
  return n;
}

function mañana(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 12)).toISOString().slice(0, 10);
}

/**
 * cumpleVigilante_: la parte de cumpleaños del cron de 15 min. Vence
 * propuestas viejas, crea la de hoy y la de mañana apenas pasan las 8am,
 * manda al instante las que ya estén Aprobadas para hoy, y recuerda una vez
 * a los Admin app las que siguen Pendientes para hoy.
 */
export async function cumpleVigilante(db: DB): Promise<{ creadas: number; enviadas: number; recordadas: number }> {
  const resultado = { creadas: 0, enviadas: 0, recordadas: 0 };
  const hoyStr = hoy();

  await db
    .from("cumple_propuestas")
    .update({ estado: "Vencida" })
    .lt("fecha", hoyStr)
    .in("estado", ["Pendiente", "Aprobada"]);

  if (minutosDelDia() >= 8 * 60) {
    if (await cumpleCrear(db, hoyStr)) resultado.creadas++;
    if (await cumpleCrear(db, mañana(hoyStr))) resultado.creadas++;
  }

  const { data: aprobadas } = await db.from("cumple_propuestas").select("*").eq("fecha", hoyStr).eq("estado", "Aprobada");
  for (const p of aprobadas ?? []) {
    try {
      await cumpleEnviar(db, p);
      resultado.enviadas++;
    } catch {
      // se reintenta en la próxima pasada del cron
    }
  }

  const { data: pendientes } = await db
    .from("cumple_propuestas")
    .select("*")
    .eq("fecha", hoyStr)
    .eq("estado", "Pendiente")
    .is("recordada_en", null);
  for (const p of pendientes ?? []) {
    const pers: PersonaCumple[] = JSON.parse(p.nombres || "[]");
    const lst = listaY(pers.map((x) => x.n));
    const { data: admins } = await db.from("perfiles").select("correo").contains("roles", ["Admin app"]);
    try {
      await avisarAdmins({
        destinatarios: (admins ?? []).map((a) => a.correo).filter(Boolean) as string[],
        asunto: `Recordatorio: falta aprobar el cumpleaños de ${lst}`,
        titulo: "Saludo de cumpleaños sin aprobar",
        datos: [["Quién cumple", lst], ["Fecha", "HOY"]],
        nota: "Sigue pendiente de aprobación en Soporte > Cumpleaños. Si no se aprueba, no se envía.",
      });
      await db.from("cumple_propuestas").update({ recordada_en: new Date().toISOString() }).eq("id", p.id);
      resultado.recordadas++;
    } catch {
      // se reintenta en la próxima pasada del cron
    }
  }

  return resultado;
}
