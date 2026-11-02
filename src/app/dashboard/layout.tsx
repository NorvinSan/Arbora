import Link from "next/link";
import { requireSession } from "@/lib/session";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-emerald-900/10 bg-white">
        <nav aria-label="Navegación principal" className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4 sm:px-10">
          <Link href="/dashboard" className="mr-auto text-lg font-bold text-emerald-800">Arbora</Link>
          <Link href="/dashboard" className="text-sm hover:underline">Mis árboles</Link>
          <Link href="/dashboard/profile" className="text-sm hover:underline">Mi perfil</Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-10">
        <p className="mb-6 text-sm text-slate-600">Sesión de {user.name}</p>
        {children}
      </main>
    </div>
  );
}
