# Arbora

Arbora es una aplicación web de código abierto para crear, organizar y explorar árboles genealógicos. Ayuda a preservar la historia familiar reuniendo personas, relaciones de parentesco, biografías y acontecimientos en un espacio privado e interactivo.

## Desarrollo local

La aplicación se inicia con `pnpm dev` en http://127.0.0.1:4327 y PostgreSQL se publica solo en `127.0.0.1:55432`. Para una instalación nueva, ejecuta `pnpm db:local:setup` y `pnpm db:migrate`. En instalaciones existentes, conserva el volumen `arbora-postgres-data` al recrear el contenedor con el puerto nuevo y actualiza las URLs de `.env.local`.

Para explorar la aplicación sin registrarte, ejecuta `pnpm db:seed`. Crea una cuenta local de demostración (`demo@arbora.local`, contraseña `ArboraDemo2026!`) y un árbol ficticio con tres generaciones. Puedes repetir el comando sin duplicar los datos. Si prefieres cargar el árbol en tu propia cuenta, regístrate y ejecuta `pnpm db:seed --owner-email tu-correo@ejemplo.com`.
