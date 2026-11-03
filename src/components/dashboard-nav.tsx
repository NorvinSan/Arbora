"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

export function DashboardNav({ name }: { name: string }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "Mis árboles", icon: LayoutGrid, active: pathname !== "/dashboard/profile" },
    { href: "/dashboard/profile", label: "Mi perfil", icon: UserRound, active: pathname === "/dashboard/profile" },
  ];

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
      <div className="flex items-center gap-1 rounded-xl bg-[#f1f5ee] p-1">
        {links.map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28543d] ${active ? "bg-white text-[#28543d] shadow-sm" : "text-[#617466] hover:text-[#28543d]"}`}>
            <Icon className="size-4" aria-hidden="true" />{label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3 sm:pl-3 sm:border-l sm:border-[#e2e9df]">
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-[#e5efe1] text-sm font-semibold text-[#28543d]">{name.trim().charAt(0).toLocaleUpperCase("es") || "A"}</span>
        <SignOutButton />
      </div>
    </div>
  );
}
