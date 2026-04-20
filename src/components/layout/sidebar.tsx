"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle,
  CircleDot,
  Home,
  LayoutGrid,
  Plug,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/objectives", label: "OKR Tree", icon: LayoutGrid },
  { href: "/my-okrs", label: "My OKRs", icon: CircleDot },
  { href: "/check-in", label: "Check-in", icon: CheckCircle },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
      <div className="h-14 px-4 flex items-center border-b border-zinc-200 dark:border-zinc-800">
        <span className="font-semibold tracking-tight">OKR App</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
