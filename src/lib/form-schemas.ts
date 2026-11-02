import { z } from "zod";

const email = z.string().trim().email("Introduce un correo electrónico válido.").max(254, "El correo es demasiado largo.").transform((value) => value.toLowerCase());
const name = z.string().trim().min(1, "Introduce tu nombre.").max(120, "El nombre no puede superar 120 caracteres.");
const newPassword = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(128, "La contraseña no puede superar 128 caracteres.");

export const registerSchema = z.object({ name, email, password: newPassword });
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Introduce tu contraseña."),
});
export const nameSchema = z.object({ name });
export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Introduce tu contraseña actual."),
  newPassword,
  confirmation: z.string().min(1, "Confirma la contraseña nueva."),
}).refine((data) => data.newPassword === data.confirmation, {
  message: "La confirmación no coincide con la contraseña nueva.",
  path: ["confirmation"],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: "La contraseña nueva debe ser diferente de la actual.",
  path: ["newPassword"],
});
