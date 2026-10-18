"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, navItemsForRole } from "@/lib/constants";
import type { AppRole } from "@/lib/auth/roles";
import { BottomNav } from "@/components/bottom-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
        <div
          aria-hidden
          className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link
            href={items[0]?.href ?? "/"}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
              <Orbit className="size-4.5" aria-hidden />
            </span>
            <span>{APP_NAME}</span>
          </Link>

          {tenantName ? (
            <span className="ml-2 hidden items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground sm:flex">
              <Building2 className="size-3.5" aria-hidden />
              {tenantName}
            </span>
          ) : null}

          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            {items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <UserMenu email={email ?? null} role={role} />
            <SignOutButton />
          </div>
        </div>
      </header>

      <BottomNav items={items} />
    </>
  );
}
