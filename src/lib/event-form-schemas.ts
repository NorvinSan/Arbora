import { z } from "zod";

export const eventTypes = ["birth", "death", "marriage", "move", "education", "work", "other", "disappearance", "last_contact", "found"] as const;

export const eventLabels: Record<(typeof eventTypes)[number], string> = {
  birth: "Nacimiento", death: "Fallecimiento", marriage: "Matrimonio", move: "Mudanza",
  education: "Educación", work: "Trabajo", other: "Otro", disappearance: "Desaparición",
  last_contact: "Último contacto", found: "Hallazgo",
};

const date = z.string().refine((value) => {
  if (!value) return true;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (year < 1 || (month !== null && (month < 1 || month > 12))) return false;
  if (day === null) return true;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month !== null && day >= 1 && day <= days[month - 1];
}, "Introduce una fecha válida (AAAA, AAAA-MM o AAAA-MM-DD).");

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

export function eventDateParts(date: string, qualifier: "exact" | "approximate" | "before" | "after") {
  const [year, month, day] = date ? date.split("-").map(Number) : [];
  return { year: year ?? null, month: month ?? null, day: day ?? null, qualifier: year ? qualifier : null };
}

export function formatEventDate(year: number | null, month: number | null, day: number | null, qualifier: string | null) {
  if (year === null) return "Fecha desconocida";
  const value = [day, month].filter((part) => part !== null).map((part) => String(part).padStart(2, "0")).concat(String(year).padStart(4, "0")).join("/");
  const prefix = { exact: "", approximate: "Aprox. ", before: "Antes de ", after: "Después de " }[qualifier ?? "exact"] ?? "";
  return prefix + value;
}
