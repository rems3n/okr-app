import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

export function Header() {
  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4">
      <OrganizationSwitcher
        hidePersonal
        appearance={{
          elements: {
            organizationSwitcherTrigger:
              "px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800",
          },
        }}
      />
      <UserButton />
    </header>
  );
}
