import { Resend } from "resend";

/**
 * Reemplaza avisoA_/avisoAdmin_ de Code.gs (correo HTML con logo negro +
 * botón amarillo a los admins/pastores) y el mailer nativo de Supabase Auth
 * (que en el plan free no deja personalizar la plantilla sin SMTP propio).
 * Mandamos nosotros el HTML, con el mismo layout que ya usaba la app vieja.
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/** Remitente de prueba de Resend — válido para cualquier destinatario sin
 * verificar un dominio propio. Cambiar a un remitente @armglobal.* apenas
 * haya un dominio verificado en Resend. */
const FROM = "armglobal <onboarding@resend.dev>";

export const APP_URL = "https://armglobal-jmnexia.vercel.app";
const LOGO_URL = `${APP_URL}/icon-512.png`;

function layout(opts: {
  etiqueta?: string;
  titulo: string;
  parrafos: string[];
  datos?: [string, string][];
  botonTexto: string;
  botonUrl: string;
}) {
  const esc = (t: string) =>
    String(t ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  const filas = (opts.datos ?? [])
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 10px 7px 0;color:#777;width:34%;vertical-align:top;border-top:1px solid #eee">${esc(
          k
        )}</td><td style="padding:7px 0;border-top:1px solid #eee"><b>${esc(v)}</b></td></tr>`
    )
    .join("");
  return `<div style="background:#f4f4f4;padding:20px 10px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden">
    <div style="background:#111;padding:14px 18px">
      <img src="${LOGO_URL}" width="36" height="36" alt="armglobal" style="display:block;border:0">
    </div>
    <div style="padding:22px 22px 8px">
      <div style="font-size:12px;letter-spacing:1px;color:#b45309;font-weight:bold">${esc(
        opts.etiqueta ?? "ARMGLOBAL"
      )}</div>
      <div style="font-size:20px;font-weight:bold;color:#111;margin:6px 0 14px">${esc(opts.titulo)}</div>
      ${opts.parrafos.map((p) => `<p style="font-size:14px;color:#222;margin:0 0 12px">${esc(p)}</p>`).join("")}
      ${filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#222;margin-top:6px">${filas}</table>` : ""}
    </div>
    <div style="padding:16px 22px 24px">
      <a href="${opts.botonUrl}" style="display:inline-block;background:#ffd23f;color:#111;font-weight:bold;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:15px">${esc(
        opts.botonTexto
      )}</a>
    </div>
  </div>
</div>`;
}

export async function enviarCorreoRecuperarClave(correo: string, link: string) {
  return resend.emails.send({
    from: FROM,
    to: correo,
    subject: "Recuperar tu clave — armglobal",
    html: layout({
      etiqueta: "RECUPERAR CLAVE",
      titulo: "Definir tu clave de armglobal",
      parrafos: [
        "Pediste recuperar el acceso a tu cuenta. Click en el botón para definir tu clave nueva.",
        "Si no fuiste tú, ignora este correo — tu cuenta sigue segura.",
      ],
      botonTexto: "Definir mi clave",
      botonUrl: link,
    }),
  });
}

/** Resultado de una solicitud de acceso (api_accesoResolver, correo al
 * solicitante — no al admin). Si fue aprobada ya puede entrar con la clave
 * que eligió al pedir el acceso; no hace falta un link de recuperación. */
export async function avisarResultadoAcceso(correo: string, nombre: string, aprobado: boolean) {
  return resend.emails.send({
    from: FROM,
    to: correo,
    subject: aprobado ? "Tu acceso fue aprobado — armglobal" : "Tu solicitud de acceso — armglobal",
    html: layout({
      etiqueta: "ACCESO A LA APP",
      titulo: aprobado ? `¡Bienvenido, ${nombre}!` : "Sobre tu solicitud",
      parrafos: aprobado
        ? ["Tu acceso a la app de armglobal fue aprobado. Entra con tu correo y la clave que elegiste al pedir el acceso."]
        : ["Tu solicitud de acceso no fue aprobada. Si crees que es un error, habla con el administrador."],
      botonTexto: aprobado ? "Entrar a la app" : "Ir a la app",
      botonUrl: aprobado ? `${APP_URL}/login` : APP_URL,
    }),
  });
}

/** Reemplaza avisoAdmin_: notifica a uno o más admins de algo que necesita su acción. */
export async function avisarAdmins(opts: {
  destinatarios: string[];
  asunto: string;
  titulo: string;
  datos: [string, string][];
  nota?: string;
  botonTexto?: string;
}) {
  const destinatarios = opts.destinatarios.filter(Boolean);
  if (!destinatarios.length) return;
  return resend.emails.send({
    from: FROM,
    to: destinatarios,
    subject: opts.asunto,
    html: layout({
      etiqueta: "TE ESPERA UNA APROBACIÓN",
      titulo: opts.titulo,
      parrafos: opts.nota ? [opts.nota] : [],
      datos: opts.datos,
      botonTexto: opts.botonTexto ?? "Abrir la app",
      botonUrl: APP_URL,
    }),
  });
}

/** Reemplaza cumpleEnviar_ (la parte de envío masivo): manda el saludo de
 * cumpleaños a toda la congregación en tandas de 50 por BCC (mismo límite
 * que usaba MailApp.sendEmail en Code.gs). Devuelve cuántos destinatarios
 * recibieron el correo (las tandas que fallan no bloquean a las demás). */
export async function enviarCumpleanos(destinatarios: string[], asunto: string, html: string, text: string): Promise<number> {
  const TANDA = 50;
  let enviados = 0;
  for (let i = 0; i < destinatarios.length; i += TANDA) {
    const tanda = destinatarios.slice(i, i + TANDA);
    try {
      await resend.emails.send({ from: FROM, to: FROM, bcc: tanda, subject: asunto, html, text });
      enviados += tanda.length;
    } catch {
      // una tanda que falla no debe perder las demás
    }
  }
  return enviados;
}
