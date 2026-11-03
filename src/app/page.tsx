import Link from "next/link";
import { ArrowRight, BookOpenText, GitBranch, LockKeyhole, Sprout } from "lucide-react";
import { FlowCanvas } from "@/components/flow-canvas";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: GitBranch,
    title: "Conecta generaciones",
    description: "Una forma visual de entender las relaciones que forman tu historia familiar.",
  },
  {
    icon: BookOpenText,
    title: "Conserva los recuerdos",
    description: "Personas, acontecimientos e historias reunidos en un mismo lugar.",
  },
  {
    icon: LockKeyhole,
    title: "Tu historia, tu espacio",
    description: "Los árboles son privados y solo acceden las personas autorizadas.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#22392d]">
      <header className="border-b border-[#dfe6dc] bg-[#faf9f6]">
        <nav aria-label="Navegación pública" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Arbora, inicio" className="flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#28543d] text-white"><Sprout className="size-5" strokeWidth={1.8} /></span>
            Arbora
          </Link>
          <div className="flex items-center gap-2 sm:gap-5">
            <Link href="#como-funciona" className="hidden text-sm text-[#56675a] transition-colors hover:text-[#28543d] md:inline">Cómo funciona</Link>
            <Button asChild variant="ghost" className="text-[#28543d]"><Link href="/login">Iniciar sesión</Link></Button>
            <Button asChild className="bg-[#28543d] text-white hover:bg-[#1d422f]"><Link href="/register">Crear cuenta</Link></Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="border-b border-[#e5e9df] bg-[#f2f5ee]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14 lg:px-12 lg:py-24">
            <div className="max-w-xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6e2d4] bg-white/70 px-3 py-1.5 text-xs font-medium tracking-wide text-[#3b6747]">
                <span className="size-1.5 rounded-full bg-[#709d70]" /> Un lugar para recordar
              </p>
              <h1 className="font-serif text-[clamp(2.8rem,5vw,5rem)] leading-[1.06] tracking-tight text-[#193d2b]">
                Cada familia tiene una historia que contar.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#536759] sm:text-lg sm:leading-8">
                Arbora te ayuda a reunir personas, vínculos y recuerdos en un árbol familiar que puedes explorar a tu ritmo.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-11 bg-[#28543d] px-5 text-white hover:bg-[#1d422f]">
                  <Link href="/register">Crear mi cuenta <ArrowRight className="size-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 border-[#bdcdbd] bg-transparent px-5 text-[#28543d] hover:bg-white">
                  <Link href="#explora">Ver una vista previa</Link>
                </Button>
              </div>
              <p className="mt-6 text-xs text-[#758879]">Un proyecto de código abierto · Tu espacio familiar privado</p>
            </div>
            <div id="explora" className="min-w-0 scroll-mt-8">
              <FlowCanvas />
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-12 px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c8158]">Lo que importa, conectado</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-[#193d2b] sm:text-4xl">Un espacio para tus raíces</h2>
            <p className="mt-4 leading-7 text-[#627365]">Más que nombres y fechas: un lugar donde cada historia encuentra su sitio.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-[#e4e9df] bg-white p-6 shadow-[0_4px_20px_rgba(25,61,43,0.025)] sm:p-7">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#ecf3e9] text-[#3d7650]"><Icon className="size-5" strokeWidth={1.8} /></span>
                <h3 className="mt-6 text-lg font-semibold text-[#243d2f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#657568]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-7 rounded-3xl bg-[#214832] px-7 py-10 text-white sm:px-10 sm:py-12 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#b6d5b5]">Tu historia comienza aquí</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">Dales un lugar a tus recuerdos.</h2>
              <p className="mt-3 text-sm leading-6 text-[#d4e5d3]">Crea tu cuenta y prepara el espacio para tu historia familiar.</p>
            </div>
            <Button asChild size="lg" className="h-11 bg-white px-5 text-[#214832] hover:bg-[#e9f1e6]">
              <Link href="/register">Empezar <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e4e9df]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-7 text-sm text-[#758679] sm:px-8 lg:px-12">
          <span className="font-semibold text-[#28543d]">Arbora</span>
          <span>Historias que nos conectan.</span>
        </div>
      </footer>
    </div>
  );
}
