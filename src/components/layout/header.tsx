import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

import { NewMenu } from "@/components/layout/new-menu";
import { SearchPalette } from "@/components/layout/search-palette";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function Header({ userId }: { userId: string }) {
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
      <div className="flex items-center gap-3">
        <SearchPalette />
        <NewMenu />
        <NotificationBell userId={userId} />
        <UserButton />
      </div>
    </header>
  );
}
