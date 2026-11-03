import Link from "next/link";
import { Sprout } from "lucide-react";
import { requireSession } from "@/lib/session";
import { DashboardNav } from "@/components/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireSession();

  return (
    <div className="min-h-screen bg-[#f7f8f3]">
      <header className="border-b border-[#dfe8dc] bg-white/95">
        <nav aria-label="Navegación principal" className="page-shell flex flex-wrap items-center justify-between gap-4 py-4">
          <Link href="/dashboard" aria-label="Arbora, mis árboles" className="inline-flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight text-[#1c4630]">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#28543d] text-white"><Sprout className="size-5" strokeWidth={1.8} /></span>
            Arbora
          </Link>
          <DashboardNav name={user.name} />
        </nav>
      </header>
      <main className="page-shell py-9 sm:py-12 lg:py-14">
        {children}
      </main>
      <footer className="page-shell pb-8 pt-6 text-xs text-[#7b8c7f]">Arbora · Historias que nos conectan.</footer>
    </div>
  );
}
