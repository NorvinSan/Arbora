import Link from "next/link";
import { ArrowLeft, GitBranch, Sprout } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-screen bg-[#f7f8f3] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#214832] p-12 text-white lg:flex xl:p-16">
        <div className="pointer-events-none absolute -right-36 top-1/4 size-[34rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-20 top-1/3 size-[25rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-0 top-1/2 size-[15rem] rounded-full border border-white/10" />
        <Link href="/" className="relative inline-flex w-fit items-center gap-3 font-heading text-3xl font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-white/15"><Sprout className="size-6" /></span>Arbora</Link>
        <div className="relative max-w-xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#d4e8d2]"><GitBranch className="size-4" /> Tu historia, en un lugar</span>
          <h1 className="font-heading text-5xl leading-[1.08] tracking-tight xl:text-6xl">Cada nombre tiene una historia detrás.</h1>
          <p className="max-w-md text-base leading-8 text-[#d6e7d6]">Reúne a tu familia, descubre sus conexiones y conserva lo que merece ser recordado.</p>
        </div>
        <p className="relative text-sm text-[#b6d1b7]">Un espacio privado para tus raíces.</p>
      </aside>
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 sm:py-10 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#526d58] hover:text-[#214832]"><ArrowLeft className="size-4" /> Volver al inicio</Link>
          <Link href="/" className="font-heading text-xl font-semibold text-[#214832] lg:hidden">Arbora</Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">{children}</div>
        <p className="text-center text-xs text-[#849388]">Arbora · Historias que nos conectan.</p>
      </div>
    </main>
  );
}
