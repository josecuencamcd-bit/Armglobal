"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Antes era un redirect de servidor directo a /encuentros. Ahora es cliente
 * porque Supabase recorta el redirectTo del correo de recuperación a la raíz
 * del dominio (ignora /actualizar-clave), así que el link de "olvidé mi
 * clave" aterriza acá con la sesión de recuperación en el hash
 * (#access_token=...&type=recovery). Si está, la reenviamos a donde sí se
 * procesa, conservando el hash; si no, sigue como antes.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      router.replace(`/actualizar-clave${window.location.hash}`);
    } else {
      router.replace("/encuentros");
    }
  }, [router]);
  return null;
}
