import { z } from "zod";
import { isValidHistoricalDate } from "@/lib/historical-date";
export { historicalDateParts as eventDateParts, formatHistoricalDate as formatEventDate } from "@/lib/historical-date";

export const eventTypes = ["birth", "death", "marriage", "move", "education", "work", "other", "disappearance", "last_contact", "found"] as const;

export const eventLabels: Record<(typeof eventTypes)[number], string> = {
  birth: "Nacimiento", death: "Fallecimiento", marriage: "Matrimonio", move: "Mudanza",
  education: "Educación", work: "Trabajo", other: "Otro", disappearance: "Desaparición",
  last_contact: "Último contacto", found: "Hallazgo",
};

const date = z.string().refine((value) => isValidHistoricalDate(value), "Introduce una fecha válida (AAAA, AAAA-MM o AAAA-MM-DD).");

export const eventSchema = z.object({
  treeId: z.string().uuid("El árbol no es válido."),
  personId: z.string().uuid("La persona no es válida."),
  type: z.enum(eventTypes, { error: "Selecciona un tipo de acontecimiento." }),
  title: z.string().trim().min(1, "Introduce un título.").max(160, "El título es demasiado largo."),
  description: z.string().trim().max(5000, "La descripción es demasiado larga."),
  date,
  qualifier: z.enum(["exact", "approximate", "before", "after"]),
  place: z.string().trim().max(250, "El lugar es demasiado largo."),
});

export const updateEventSchema = eventSchema.extend({ eventId: z.string().uuid("El acontecimiento no es válido.") });
export const deleteEventSchema = eventSchema.pick({ treeId: true, personId: true }).extend({ eventId: z.string().uuid("El acontecimiento no es válido.") });
