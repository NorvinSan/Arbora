import { z } from "zod";
import { isValidHistoricalDate } from "@/lib/historical-date";

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

const optionalDate = z.string().refine((value) => isValidHistoricalDate(value, true), "Introduce una fecha válida.");

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

export const addRelativeSchema = z.object({
  treeId: addPersonSchema.shape.treeId,
  anchorId: z.uuid("Selecciona una persona del árbol."),
  relationship: z.enum(["parent", "child", "partner"]),
  personMode: z.enum(["new", "existing"]),
  existingId: z.string(),
  person: z.object({
    displayName: z.string().trim().max(120),
    givenName: addPersonSchema.shape.givenName,
    familyName: addPersonSchema.shape.familyName,
    lifeStatus: addPersonSchema.shape.lifeStatus,
    whereaboutsStatus: addPersonSchema.shape.whereaboutsStatus,
  }),
  relationType: createParentChildSchema.shape.relationType,
  kind: createPartnershipSchema.shape.kind,
  startDate: createPartnershipSchema.shape.startDate,
  endDate: createPartnershipSchema.shape.endDate,
}).superRefine((input, ctx) => {
  if (input.personMode === "new" && !input.person.displayName) ctx.addIssue({ code: "custom", path: ["person", "displayName"], message: "Introduce un nombre para la persona." });
  if (input.personMode === "existing") {
    if (!z.uuid().safeParse(input.existingId).success) ctx.addIssue({ code: "custom", path: ["existingId"], message: "Selecciona una persona válida." });
    else if (input.existingId === input.anchorId) ctx.addIssue({ code: "custom", path: ["existingId"], message: "Elige a otra persona." });
  }
  if (input.relationship === "partner" && input.startDate && input.endDate && input.endDate < input.startDate) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fecha de fin no puede ser anterior a la de inicio." });
  }
});
