"use client";

/** Reduce una foto (comprobante, boleta, cierre de caja) a un jpeg en
 * base64 que entre en el límite que aceptan las rutas que usan
 * subirFotoJpeg (8MB de base64, pero en la práctica conviene mandar algo
 * mucho más chico): recorta el lado más largo a `maxLado` sin deformar, y
 * comprime en pasos hasta entrar en `maxBase64` caracteres. */
export async function fotoAJpegDataUrl(file: File, maxLado = 1600, maxBase64 = 1_500_000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  for (const calidad of [0.85, 0.7, 0.55, 0.4, 0.25]) {
    const url = canvas.toDataURL("image/jpeg", calidad);
    if (url.length <= maxBase64) return url;
  }
  throw new Error("La foto es muy pesada. Prueba con otra.");
}
