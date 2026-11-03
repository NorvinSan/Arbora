"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth-actions";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function signOut() {
    setError("");
    startTransition(async () => {
      try {
        const result = await signOutAction();
        if (!result.ok) return setError(result.message);
        router.replace("/login");
        router.refresh();
      } catch {
        setError("No se pudo conectar con el servidor.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="ghost" className="px-2 text-[#607266] hover:bg-[#f1f5ee] hover:text-[#28543d] sm:px-3" onClick={signOut} disabled={pending}>
        <LogOut className="size-4" aria-hidden="true" />{pending ? "Saliendo…" : "Salir"}
      </Button>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
