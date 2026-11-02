import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="text-lg font-bold tracking-wide text-emerald-800">Arbora</Link>
      {children}
    </main>
  );
}
