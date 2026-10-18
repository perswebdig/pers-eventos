"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Circle,
  FileText,
  Home,
  LayoutDashboard,
  MoreHorizontal,
  QrCode,
  Receipt,
  ScanLine,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "cn";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/pessoas": Users,
  "/eventos": CalendarDays,
  "/pedidos": Receipt,
  "/checkin": ScanLine,
  "/termos": FileText,
  "/usuarios": UserCog,
  "/relatorios": BarChart3,
  "/admin": Building2,
  "/admin/estabelecimentos": Building2,
  "/portal": Home,
  "/portal/ingressos": Ticket,
  "/portal/qr": QrCode,
  "/portal/termos": FileText,
};

type NavItemLite = { href: string; label: string };

const ITEM_CLASS =
  "relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors";

export function BottomNav({
  items,
  className,
}: {
  items: readonly NavItemLite[];
  className?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (items.length === 0) return null;

  const primary = items.length > 5 ? items.slice(0, 4) : items;
  const extra = items.length > 5 ? items.slice(4) : [];
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const moreActive = extra.some((item) => item.href === activeHref);

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-xl md:hidden",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className="grid h-14"
        style={{
          gridTemplateColumns: `repeat(${primary.length + (extra.length ? 1 : 0)}, minmax(0, 1fr))`,
        }}
      >
        {primary.map((item) => {
          const Icon = ICONS[item.href] ?? Circle;
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  ITEM_CLASS,
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-glow"
                  />
                ) : null}
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
        {extra.length ? (
          <li>
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger
                aria-label="Mais opções"
                className={cn(
                  ITEM_CLASS,
                  moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {moreActive ? (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-glow"
                  />
                ) : null}
                <MoreHorizontal className="size-5" />
                <span>Mais</span>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              >
                <SheetHeader>
                  <SheetTitle>Mais opções</SheetTitle>
                </SheetHeader>
                <ul className="mt-2 space-y-1">
                  {extra.map((item) => {
                    const Icon = ICONS[item.href] ?? Circle;
                    const active = item.href === activeHref;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                            active ? "bg-primary/12 text-primary" : "hover:bg-muted",
                          )}
                        >
                          <Icon className="size-4.5 text-muted-foreground" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
