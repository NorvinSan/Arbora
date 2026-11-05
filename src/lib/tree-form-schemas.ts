import { z } from "zod";

export const createTreeSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre al árbol.").max(120, "El nombre no puede superar 120 caracteres."),
  description: z.string().trim().max(1000, "La descripción no puede superar 1000 caracteres."),
});

export const addPersonSchema = z.object({
  treeId: z.string().uuid("El árbol no es válido."),
  displayName: z.string().trim().min(1, "Introduce un nombre para la persona.").max(120, "El nombre no puede superar 120 caracteres."),
  givenName: z.string().trim().max(120, "El nombre es demasiado largo."),
  familyName: z.string().trim().max(120, "Los apellidos son demasiado largos."),
  lifeStatus: z.enum(["living", "deceased", "unknown"]),
  whereaboutsStatus: z.enum(["known", "missing", "unknown"]),
});

const relationIdsSchema = z.object({
  treeId: z.string().uuid("El árbol no es válido."),
  parentId: z.string().uuid("Selecciona un progenitor válido."),
  childId: z.string().uuid("Selecciona un hijo o hija válido."),
}).refine((value) => value.parentId !== value.childId, {
  path: ["childId"],
  message: "Una persona no puede ser su propio progenitor.",
});

export const createParentChildSchema = relationIdsSchema.safeExtend({
  relationType: z.enum(["biological", "adoptive", "other"], { error: "Selecciona un tipo de parentesco." }),
});

export const deleteParentChildSchema = relationIdsSchema;

const optionalDate = z.string().refine((value) => {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}, "Introduce una fecha válida.");

export const createPartnershipSchema = z.object({
  treeId: z.string().uuid("El árbol no es válido."),
  personAId: z.string().uuid("Selecciona una persona válida."),
  personBId: z.string().uuid("Selecciona una pareja válida."),
  kind: z.enum(["marriage", "union", "partnership"], { error: "Selecciona un tipo de relación." }),
  startDate: optionalDate,
  endDate: optionalDate,
}).superRefine(({ personAId, personBId, startDate, endDate }, ctx) => {
  if (personAId === personBId) ctx.addIssue({ code: "custom", path: ["personBId"], message: "Una persona no puede ser su propia pareja." });
  if (startDate && endDate && endDate < startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fecha de fin no puede ser anterior a la de inicio." });
});

export const deletePartnershipSchema = z.object({
  treeId: z.string().uuid("El árbol no es válido."),
  partnershipId: z.string().uuid("La relación no es válida."),
});
