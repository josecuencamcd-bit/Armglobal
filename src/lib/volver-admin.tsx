"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Cuando se llega a esta pantalla desde Administración (vAdministracion()
 * de la app vieja la rendeaba inline, con "Volver" fijo en la barra
 * inferior), mostramos el mismo atajo de vuelta — igual idea, adaptada a
 * que aquí cada sección vive en su propia ruta en vez de en la misma
 * pantalla. Administración agrega "?admin=1" al link para marcar el
 * origen; sin ese parámetro (alguien que llegó por el menú normal) no se
 * muestra nada. */
function VolverAdministracionInterno() {
  const admin = useSearchParams().get("admin");
  if (!admin) return null;
  return (
    <Link
      href="/administracion"
      className="muted"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.82rem", marginBottom: 10, textDecoration: "none" }}
    >
      ‹ Volver a Administración
    </Link>
  );
}

export function VolverAdministracion() {
  return (
    <Suspense fallback={null}>
      <VolverAdministracionInterno />
    </Suspense>
  );
}
