type AuthError = { code?: string; status?: number } | null;

export function authErrorMessage(error: AuthError, context: "register" | "login" | "profile" | "password" | "logout") {
  if (error?.status === 503) return "La autenticación no está configurada o no está disponible. Inténtalo más tarde.";
  if (error?.status === 429) return "Demasiados intentos. Espera un momento antes de volver a intentarlo.";

  switch (error?.code) {
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ese correo ya está registrado. Inicia sesión o usa otro correo.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "El correo o la contraseña no son correctos.";
    case "INVALID_EMAIL":
      return "Introduce un correo electrónico válido.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "La contraseña no puede superar 128 caracteres.";
    case "INVALID_PASSWORD":
      return context === "password" ? "La contraseña actual no es correcta." : "La contraseña no es válida.";
    default:
      return {
        register: "No se pudo crear la cuenta. Revisa tus datos e inténtalo de nuevo.",
        login: "No se pudo iniciar sesión. Inténtalo de nuevo.",
        profile: "No se pudo actualizar el perfil. Inténtalo de nuevo.",
        password: "No se pudo cambiar la contraseña. Inténtalo de nuevo.",
        logout: "No se pudo cerrar sesión. Inténtalo de nuevo.",
      }[context];
  }
}
