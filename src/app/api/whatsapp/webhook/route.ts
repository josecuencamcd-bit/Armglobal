import { createAdminClient } from "@/lib/supabase/admin";
import { telefonoWa, enviarWhatsApp } from "@/lib/whatsapp";

/**
 * Puerto 1:1 de doGet (verificación)/doPost (mensajes entrantes) de Code.gs
 * para el webhook de WhatsApp Business Cloud API. No hay sesión de usuario
 * (Meta llama directo), así que usa el cliente service_role — es uno de los
 * dos únicos lugares autorizados a usarlo (el otro son los vigilantes/cron).
 *
 * Flujo soportado (igual que Code.gs): un Pastor de campus responde "OK"/
 * "SÍ"/"SI" o "NO" a una autorización de fondo pendiente de su Ok
 * ("Pendiente Pastor"); cualquier otro texto se ignora en silencio. Si hay
 * más de una solicitud pendiente para ese pastor, se procesa la más antigua.
 */

/** Verificación del webhook de Meta: GET con hub.mode/hub.verify_token/hub.challenge. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const modo = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (modo === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function normalizarTexto(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msgs = value?.messages ?? [];
    if (!msgs.length) return waOk();

    const msg = msgs[0];
    const de: string = msg.from; // número E.164 sin '+', ej. "56912345678"
    const texto = normalizarTexto(msg.type === "text" ? msg.text?.body ?? "" : "");

    const esOk = texto === "OK" || texto === "SI" || texto === "S" || texto.slice(0, 2) === "OK";
    const esNo = texto === "NO" || texto === "N";
    if (!esOk && !esNo) return waOk();

    const supabase = createAdminClient();

    // Buscar quién es por su número de teléfono guardado en su perfil.
    const normalizado = telefonoWa(de);
    const { data: perfiles } = await supabase.from("perfiles").select("*").not("telefono", "is", null);
    const perfil = (perfiles ?? []).find((p) => telefonoWa(p.telefono) === normalizado);
    if (!perfil) return waOk(); // número desconocido, ignorar

    const esPastorDeCampus = perfil.roles.includes("Pastor de campus");
    if (!esPastorDeCampus) return waOk();

    const { data: pendientes } = await supabase
      .from("autorizaciones_fondos")
      .select("*")
      .eq("estado", "Pendiente Pastor")
      .order("pedido", { ascending: true });

    const misPendientes = (pendientes ?? []).filter(
      (r) => perfil.campus === null || r.campus === perfil.campus
    );
    // Nota: Code.gs trataba campus==='Todos' como "ve todo"; acá un Pastor
    // de campus normalmente tiene un `campus` fijo, así que el filtro por
    // igualdad ya cubre el caso común. Un Pastor "de todos los campus" (sin
    // `campus` asignado) ve todas las solicitudes, como arriba.

    if (!misPendientes.length) {
      await enviarWhatsApp(de, "No tienes solicitudes de autorización pendientes en este momento. Entra a la app para ver el detalle.");
      return waOk();
    }

    const x = misPendientes[0];
    const cuando = new Date().toISOString();
    const tit = `${x.area === "Campus" ? "Finanzas del campus" : "Fondo de " + x.area} · ${x.mes}`;

    if (esNo) {
      await supabase
        .from("autorizaciones_fondos")
        .update({
          estado: "Rechazada",
          pastor: perfil.nombre,
          pastor_en: cuando,
          rechazo: "El Pastor de campus rechazó por WhatsApp.",
        })
        .eq("id", x.id);

      await enviarWhatsApp(de, `✅ Rechazado. Se notificó a ${x.solicitante}.\n\nFondo: ${tit}\nCampus: ${x.campus}`);
      if (misPendientes.length > 1) {
        await enviarWhatsApp(
          de,
          `Tienes ${misPendientes.length - 1} solicitud(es) más pendiente(s). Responde OK o NO para la siguiente, o entra a la app.`
        );
      }
      return waOk();
    }

    // esOk
    await supabase
      .from("autorizaciones_fondos")
      .update({ estado: "Pendiente Admin", pastor: perfil.nombre, pastor_en: cuando })
      .eq("id", x.id);

    await enviarWhatsApp(
      de,
      `✅ Ok registrado. Pasa al administrador de la app para la aprobación final.\n\nFondo: ${tit}\nCampus: ${x.campus}\nQuién pide: ${x.solicitante}`
    );
    if (misPendientes.length > 1) {
      await enviarWhatsApp(de, `Tienes ${misPendientes.length - 1} solicitud(es) más pendiente(s). Responde OK o NO, o entra a la app.`);
    }
    return waOk();
  } catch (err) {
    console.error("whatsapp webhook:", err);
    return waOk(); // Meta espera 200 rápido siempre, igual que _waOk() en Code.gs
  }
}

function waOk() {
  return new Response("", { status: 200, headers: { "Content-Type": "text/plain" } });
}
