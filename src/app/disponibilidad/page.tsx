import type { Metadata } from "next";
import DisponibilidadForm from "./formulario";

/**
 * Página pública (sin login, fuera del grupo (app)) de la encuesta de
 * disponibilidad de servicio — Task 3 del pedido de voz de José Miguel.
 * Server Component solo para poder declarar `metadata` (Open Graph): así
 * el link se ve como "una tarjetita bien ordenada" al compartirse por
 * WhatsApp, con el mismo título/tono de la encuesta nativa que ya usaban
 * ("Disponibilidad de servicio ✨").
 *
 * VISTA PREVIA: todavía no se reparte este link al equipo — José Miguel
 * pidió verlo primero y hacer ajustes antes de que sea el link real que se
 * reusa cada semana.
 */
export const metadata: Metadata = {
  title: "Disponibilidad de servicio ✨ · ARM Global",
  description: "Marca los encuentros de esta semana en los que puedes servir. Toma un minuto.",
  openGraph: {
    title: "Disponibilidad de servicio ✨",
    description: "Marca los encuentros de esta semana en los que puedes servir.",
    images: ["/icon-512.png"],
    locale: "es_CL",
  },
};

export const dynamic = "force-dynamic";

export default function DisponibilidadPage() {
  return <DisponibilidadForm />;
}
