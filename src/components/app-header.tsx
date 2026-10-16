"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, navItemsForRole } from "@/lib/constants";
import type { AppRole } from "@/lib/auth/roles";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncStatusChip } from "@/components/sync-status-chip";
import { UserMenu } from "@/components/user-menu";

export function AppHeader({
  email,
  role = "staff",
  tenantName,
}: {
  email?: string | null;
  role?: AppRole;
  tenantName?: string | null;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2 font-semibold">
          <Leaf className="size-5 text-green-700 dark:text-green-500" aria-hidden />
          <span>{APP_NAME}</span>
        </Link>

        {tenantName ? (
          <span className="ml-2 hidden items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground sm:flex">
            <Building2 className="size-3.5" aria-hidden />
            {tenantName}
          </span>
        ) : null}

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SyncStatusChip />
          <ThemeToggle />
          <UserMenu email={email ?? null} role={role} />
        </div>
      </div>

      {/* Navegação inferior no mobile (uso em campo/tablet) */}
      <nav
        className="flex items-center gap-1 overflow-x-auto border-t px-2 py-1 md:hidden"
        aria-label="Navegação principal"
      >
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
