"use client";

/**
 * Link "‹ Volver" en Reporte/Aportes/Checklist que antes siempre apuntaba a
 * una ruta fija (p. ej. Aportes → Reporte, Reporte → Encuentros) sin
 * importar de dónde venías. El problema: desde Notificaciones (u otro
 * acceso directo) se puede entrar directo a Aportes o a Checklist sin
 * pasar por el Reporte — y al tocar "volver" igual te mandaba al Reporte,
 * una pantalla en la que nunca habías estado.
 *
 * Acá en vez de eso usamos router.back() cuando hay desde dónde volver
 * dentro de la misma sesión del navegador (window.history.length > 1) —
 * así vuelve a la pantalla real de origen, sea cual sea. Solo si no hay
 * historial propio (se abrió el link suelto, p. ej. en una pestaña nueva)
 * cae al destino fijo que se le pasa por prop, para no dejar al usuario
 * sin salida.
 */
import { useRouter } from "next/navigation";

export function VolverInteligente({ href, label = "‹ Volver" }: { href: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(href);
      }}
      className="muted"
      style={{
        fontSize: "0.82rem", textDecoration: "none", background: "none",
        border: "none", padding: 0, cursor: "pointer", font: "inherit",
      }}
    >
      {label}
    </button>
  );
}
