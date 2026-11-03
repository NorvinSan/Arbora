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
