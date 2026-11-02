import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authErrorMessage } from "../src/lib/auth-errors";
import { loginSchema, nameSchema, passwordSchema, registerSchema } from "../src/lib/form-schemas";

describe("registro", () => {
  const valid = { name: "Ana Rivera", email: "ana@example.com", password: "secreto123" };

  it("rechaza los datos obligatorios vacíos y los correos inválidos", () => {
    assert.equal(registerSchema.safeParse({ ...valid, name: "   " }).success, false);
    assert.equal(registerSchema.safeParse({ ...valid, email: "no-es-un-correo" }).success, false);
    assert.equal(registerSchema.safeParse({ ...valid, password: "" }).success, false);
  });

  it("aplica los límites de contraseña sin modificarla", () => {
    assert.equal(registerSchema.safeParse({ ...valid, password: "1234567" }).success, false);
    assert.equal(registerSchema.safeParse({ ...valid, password: "x".repeat(129) }).success, false);
    assert.equal(registerSchema.parse({ ...valid, password: " secreto123 " }).password, " secreto123 ");
  });

  it("normaliza nombre y correo antes de registrar", () => {
    const result = registerSchema.parse({ ...valid, name: "  Ana Rivera  ", email: "  ANA@EXAMPLE.COM  " });
    assert.equal(result.name, "Ana Rivera");
    assert.equal(result.email, "ana@example.com");
  });

  it("muestra un error comprensible si el correo ya está registrado", () => {
    assert.match(authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }, "register"), /correo ya está registrado/i);
  });
});

describe("inicio de sesión y perfil", () => {
  it("rechaza el inicio sin contraseña y no filtra detalles ante credenciales incorrectas", () => {
    assert.equal(loginSchema.safeParse({ email: "ana@example.com", password: "" }).success, false);
    assert.equal(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, "login"), "El correo o la contraseña no son correctos.");
  });

  it("impide guardar un nombre vacío", () => {
    assert.equal(nameSchema.safeParse({ name: "  " }).success, false);
  });

  it("exige confirmación y una nueva contraseña diferente", () => {
    const values = { currentPassword: "anterior123", newPassword: "nueva45678", confirmation: "nueva45678" };
    assert.equal(passwordSchema.safeParse({ ...values, confirmation: "no coincide" }).success, false);
    assert.equal(passwordSchema.safeParse({ ...values, newPassword: values.currentPassword, confirmation: values.currentPassword }).success, false);
    assert.equal(passwordSchema.safeParse(values).success, true);
  });

  it("no presenta errores internos sin mapear al usuario", () => {
    assert.equal(authErrorMessage({ code: "DATABASE_FAILURE" }, "profile"), "No se pudo actualizar el perfil. Inténtalo de nuevo.");
  });
});
