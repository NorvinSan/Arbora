# Arbora

Aplicación de código abierto para crear y explorar árboles genealógicos privados. Construida con Next.js, React, TypeScript, PostgreSQL, Drizzle ORM, Better Auth y React Flow.

## Empezar

Necesitas Node.js 20.9+ (recomendado 22), pnpm 10 y Podman. Desde la raíz del proyecto:

```bash
pnpm install
pnpm db:local:setup # solo la primera vez
pnpm db:migrate
pnpm dev
```

Abre [localhost:3000](http://localhost:3000). El setup crea PostgreSQL local y genera `.env.local` y `.env.podman.local` con claves aleatorias; **ambos archivos están ignorados por Git**. Si usas otra base de datos, configura `DATABASE_URL`, `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` fuera del repositorio.

## Estado actual

Puedes registrarte, iniciar sesión, crear árboles privados y agregar personas. El propietario y los colaboradores `editor` pueden agregar integrantes; los `viewer` solo pueden consultar. El lienzo de la landing es una demostración y no guarda cambios.

Para cargar una familia ficticia en tu cuenta, después de registrarte:

```bash
pnpm db:seed --owner-email TU_CORREO_DE_DESARROLLO
```

## Comandos útiles

```bash
pnpm db:local:stop   # detener PostgreSQL sin borrar datos
pnpm db:local:start  # volver a iniciarlo
pnpm test            # pruebas sin base de datos
pnpm lint
pnpm typecheck
pnpm build
```

Con la base migrada y la app en marcha, `pnpm test:integration` comprueba autenticación y aislamiento entre árboles con cuentas temporales.
