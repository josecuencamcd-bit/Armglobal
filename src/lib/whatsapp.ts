/**
 * Puerto 1:1 de la sección "WhatsApp: alertas junto al correo" de Code.gs
 * (WhatsApp Business Cloud API de Meta). En Code.gs, `whatsappConfigurado_`
 * leía WA_TOKEN/WA_PHONE_ID de PropertiesService; acá son variables de
 * entorno de Vercel. Sin ellas configuradas, enviarWhatsApp() no hace nada
 * (igual que en Code.gs — nunca rompe el flujo que lo llama).
 */
export function whatsappConfigurado(): boolean {
  return !!(process.env.WA_TOKEN && process.env.WA_PHONE_ID);
}

/** Normaliza un teléfono chileno a E.164 sin '+' (lo que pide la API de WhatsApp). */
export function telefonoWa(t: string | null | undefined): string {
  let n = String(t ?? "").replace(/\D/g, "");
  if (!n) return "";
  if (n.charAt(0) === "0") n = n.slice(1);
  if (n.length === 9 && n.charAt(0) === "9") n = "56" + n; // celular chileno sin código de país
  return n;
}

/** Envía un WhatsApp de texto simple. Silencioso si no está configurado o si falla. */
export async function enviarWhatsApp(telefono: string, texto: string): Promise<boolean> {
  if (!telefono || !whatsappConfigurado()) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WA_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "text",
        text: { body: String(texto).slice(0, 4000), preview_url: false },
      }),
    });
    if (!res.ok) console.error("enviarWhatsApp:", await res.text());
    return res.ok;
  } catch (e) {
    console.error("enviarWhatsApp:", e);
    return false;
  }
}

/** Envía el mismo aviso a cada destinatario que tenga teléfono guardado (junto al correo, nunca en su lugar). */
export async function avisoWhatsApp(telefonos: (string | null)[], texto: string): Promise<void> {
  if (!whatsappConfigurado()) return;
  await Promise.all(telefonos.filter((t): t is string => !!t).map((t) => enviarWhatsApp(telefonoWa(t), texto)));
}

/** Aviso al "grupo" de WhatsApp del campus: la API no deja publicar dentro de
 * un grupo ya creado, así que el mismo mensaje llega por separado a cada
 * número de WA_GRUPO_NUMEROS (coma-separado). */
export async function avisoWhatsAppGrupo(texto: string): Promise<void> {
  if (!whatsappConfigurado()) return;
  const nums = (process.env.WA_GRUPO_NUMEROS ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  await Promise.all(nums.map((n) => enviarWhatsApp(n, texto)));
}
