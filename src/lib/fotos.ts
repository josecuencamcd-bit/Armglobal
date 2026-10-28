import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reemplaza carpetaFotos_/guardarFotoFin_/api_getFoto de Code.gs (que subían
 * a una carpeta de Drive y devolvían el blob en base64 solo si el usuario
 * tenía permiso sobre el registro). Acá usamos un bucket PRIVADO de Supabase
 * Storage ("fotos", sin policies para anon/authenticated) — toda subida,
 * borrado y lectura pasa por el cliente admin (service_role) desde las
 * rutas, que son las que ya verifican permisos (vía RLS en la fila dueña de
 * la foto). Nunca se expone una URL pública directa.
 */
const BUCKET = "fotos";
const JPEG_RE = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

/** Sube una foto jpeg en base64 (mismo formato/límite que guardarFotoFin_ y
 * api_subirFoto: 8MB de base64). Devuelve el path dentro del bucket. */
export async function subirFotoJpeg(dataUrl: string, carpeta: string, nombre: string, maxBase64 = 8_000_000) {
  const m = JPEG_RE.exec(String(dataUrl || ""));
  if (!m) throw new Error("La foto no es válida.");
  if (m[1].length > maxBase64) throw new Error("La foto es demasiado grande.");
  const bytes = Buffer.from(m[1], "base64");
  const path = `${carpeta}/${nombre}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** URL firmada de corta duración para ver una foto — el llamador ya debe
 * haber verificado permiso sobre el registro dueño (vía RLS). */
export async function firmarFoto(path: string, segundos = 300) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, segundos);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function borrarFoto(path: string) {
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([path]);
}
