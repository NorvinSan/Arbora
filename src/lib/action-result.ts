export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; message: string };

export const sessionExpired = { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." } as const;

export function postgresErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    const code = (current as Error & { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = current.cause;
  }
  return undefined;
}
