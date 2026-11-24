import { z } from "zod";

/** Un ítem del Checklist pre-encuentro. "personas" es texto libre (nombres
 * separados como se quiera escribir) porque cambia cada semana; "detalle"
 * es la descripción fija del ítem (editable, pero normalmente no cambia). */
export type ChecklistItem = {
  id: string;
  titulo: string;
  detalle: string;
  personas: string;
  hecho: boolean;
};

export const ChecklistItemSchema = z.object({
  id: z.string().min(1).max(40),
  titulo: z.string().min(1).max(120),
  detalle: z.string().max(300),
  personas: z.string().max(300),
  hecho: z.boolean(),
});

export const ChecklistSchema = z.object({
  items: z.array(ChecklistItemSchema).max(60),
  observacion: z.string().max(2000),
});

/**
 * Plantilla fija de partida (igual a la lista que se comparte por
 * WhatsApp) — cada encuentro arranca con esta misma lista; el
 * administrador puede agregar o sacar un ítem puntual si hace falta, pero
 * no empieza de cero cada semana.
 */
export function plantillaChecklist(): ChecklistItem[] {
  const base: { titulo: string; detalle?: string }[] = [
    { titulo: "Mesa del Café", detalle: "Instalada, ordenada y operativa" },
    { titulo: "Baños", detalle: "Limpios y habilitados" },
    { titulo: "Baño de Movilidad Reducida", detalle: "Limpio y operativo" },
    { titulo: "Sala Interior", detalle: "Preparada y ordenada" },
    { titulo: "Auditorio", detalle: "Listo para recibir a las personas" },
    { titulo: "Escenario" },
    { titulo: "Patio", detalle: "Ordenado y experiencia lista" },
    { titulo: "TV", detalle: "Contador de almas operativo" },
    { titulo: "Equipo de seguridad" },
    { titulo: "Parlante en patio" },
    { titulo: "Stand Oración" },
    { titulo: "Case de Siembra" },
    { titulo: "Merch" },
    { titulo: "Salita de bebés" },
    { titulo: "Equipo de conexión" },
    { titulo: "Stand de un Regalo mil sonrisas" },
  ];
  return base.map((b, i) => ({
    id: `item-${i + 1}`,
    titulo: b.titulo,
    detalle: b.detalle ?? "",
    personas: "",
    hecho: false,
  }));
}
