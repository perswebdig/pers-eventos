"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/lib/auth/use-sign-out";
import { ROLE_LABEL, type AppRole } from "@/lib/auth/roles";

export function UserMenu({ email, role = "staff" }: { email: string | null; role?: AppRole }) {
  const { signOut, saindo } = useSignOut();

  if (!email) return null;

  const inicial = email.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menu do usuário"
            className="rounded-full"
          />
        }
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {inicial}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{email}</span>
          <span className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[role]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={saindo} onClick={() => void signOut()}>
          <LogOut className="size-4" />
          {saindo ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
