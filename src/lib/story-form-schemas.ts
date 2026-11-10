import { z } from "zod";

// Stories are plain text. React renders them as text, and markup is rejected on
// both client and server so they cannot turn into executable HTML later.
const plainText = (max: number) => z.string().trim().min(1, "Este campo es obligatorio.")
  .max(max, `No puede superar ${max} caracteres.`)
  .refine((value) => !/<\s*\/?\s*[a-z][^>]*>/i.test(value), "Escribe texto sin etiquetas HTML.");

export const storySchema = z.object({
  treeId: z.string().uuid("El árbol no es válido."),
  title: plainText(160),
  body: plainText(10000),
  personIds: z.array(z.string().uuid("La persona no es válida.")).max(100, "Demasiados participantes.")
    .refine((ids) => new Set(ids).size === ids.length, "No repitas participantes."),
});

export const updateStorySchema = storySchema.extend({ storyId: z.string().uuid("El relato no es válido.") });
export const deleteStorySchema = storySchema.pick({ treeId: true }).extend({ storyId: z.string().uuid("El relato no es válido.") });
export const storyParticipantSchema = deleteStorySchema.extend({ personId: z.string().uuid("La persona no es válida.") });
