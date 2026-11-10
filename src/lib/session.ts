import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth-config";

export const getCurrentSession = cache(async () => {
  if (!isAuthConfigured()) {
    return null;
  }

  const { auth } = await import("@/lib/auth");
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
