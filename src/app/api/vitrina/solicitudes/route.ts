import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, parseBody } from "@/lib/api-helpers";
import { subirFotoJpeg } from "@/lib/fotos";
import { avisarAdmins } from "@/lib/email";
import { CAMPUS } from "@/lib/sesiones";
import { z } from "zod";

const ROLES_FINANZAS = ["Pastor de campus", "Pastor", "Pastor principal", "Ministro", "Administrador"] as const;

const SolicitudPublicaSchema = z.object({
  campus: z.enum(CAMPUS, { error: () => "Campus no válido." }),
  producto_id: z.number().int().positive(),
  cantidad: z.number().int().min(1).max(50).default(1),
  nombre: z.string().trim().min(1, "Falta tu nombre.").max(120),
  contacto: z.string().trim().min(1, "Deja un teléfono o correo para avisarte.").max(120),
  metodo_pago: z.enum(["Transferencia", "Presencial"], { error: () => "Elige cómo vas a pagar." }),
  // Mismo patrón que /api/merch/solicitudes: llega como data URL jpeg y se
  // sube server-side al bucket privado "fotos" — quien llena el formulario
  // nunca maneja la URL. Solo tiene sentido si pagó por Transferencia.
  comprobante: z.string().optional(),
  nota: z.string().trim().max(300).optional(),
});

/**
 * Solicitud de compra desde la vitrina pública (/vitrina) — a diferencia de
 * /api/merch/producto-solicitudes (que exige sesión), acá cualquiera sin
 * cuenta en la app puede pedir. Usa el cliente admin para insertar (no hay
 * auth.uid() para que la policy de RLS evalúe) y, apenas queda guardada,
 * avisa por correo a quien lidera Merch + a Finanzas (Pastor/Ministro/
 * Administrador) de ese campus — son quienes la resuelven desde Mi equipo.
 */
export async function POST(req: Request) {
  const parsedBody = await parseBody(req, SolicitudPublicaSchema);
  if ("error" in parsedBody) return parsedBody.error;
  const { comprobante, ...resto } = parsedBody.data;

  const admin = createAdminClient();

  const { data: producto, error: errProd } = await admin
    .from("merch_productos")
    .select("id, nombre, precio, stock, activo, campus")
    .eq("id", resto.producto_id)
    .maybeSingle();
  if (errProd) return fail(errProd.message, 400);
  if (!producto || !producto.activo || producto.campus !== resto.campus) return fail("Ese producto ya no está disponible.", 404);
  if (resto.cantidad > producto.stock) return fail(`Solo quedan ${producto.stock} unidades.`, 409);

  let comprobante_url: string | null = null;
  try {
    if (comprobante) {
      comprobante_url = await subirFotoJpeg(comprobante, "merch-vitrina", `Solicitud - ${resto.campus} - ${Date.now()}.jpg`);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo subir el comprobante.", 400);
  }

  const { data, error } = await admin
    .from("merch_producto_solicitudes")
    .insert({
      campus: resto.campus,
      producto_id: resto.producto_id,
      cantidad: resto.cantidad,
      solicitante: resto.nombre,
      correo_solicitante: resto.contacto,
      metodo_pago: resto.metodo_pago,
      comprobante_url,
      nota: resto.nota,
    })
    .select()
    .single();
  if (error) return fail(error.message, 400);

  after(async () => {
    try {
      const { data: destinatarios } = await admin
        .from("perfiles")
        .select("correo, roles, areas, sirve")
        .eq("campus", resto.campus);
      const correos = (destinatarios ?? [])
        .filter((p) => p.areas?.includes("Merch") || p.sirve?.includes("Merch") || p.roles?.some((r) => (ROLES_FINANZAS as readonly string[]).includes(r)))
        .map((p) => p.correo)
        .filter((c): c is string => !!c);
      await avisarAdmins({
        destinatarios: correos,
        asunto: `Nueva solicitud de compra: ${producto.nombre}`,
        titulo: "Alguien pidió comprar desde la vitrina de Merch",
        datos: [
          ["Producto", `${producto.nombre} × ${resto.cantidad}`],
          ["Quién pide", resto.nombre],
          ["Contacto", resto.contacto],
          ["Pago", resto.metodo_pago],
          ["Campus", resto.campus],
          ...(resto.nota ? [["Nota", resto.nota] as [string, string]] : []),
        ],
        nota: "Confírmala desde Mi equipo → Merch cuando la entregues (ahí se descuenta el stock).",
      });
    } catch {
      // no bloqueamos la solicitud por un fallo de envío
    }
  });

  return ok(data, 201);
}
