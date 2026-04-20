"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings", label: "General" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/teams", label: "Teams" },
  { href: "/settings/cycles", label: "Cycles" },
  { href: "/settings/profile", label: "Profile" },
];

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return (
    <div className="max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <nav className="border-b border-zinc-200 dark:border-zinc-800 mb-6 flex gap-6">
        {tabs.map((tab) => {
          const active =
            tab.href === "/settings"
              ? pathname === "/settings"
              : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "pb-2 -mb-px text-sm transition-colors border-b-2",
                active
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
