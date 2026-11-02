import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

async function handler(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) {
    return Response.json({ error: "Autenticación sin configurar en el servidor." }, { status: 503 });
  }

  const { auth } = await import("@/lib/auth");
  const handlers = toNextJsHandler(auth);
  return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export const GET = handler;
export const POST = handler;
