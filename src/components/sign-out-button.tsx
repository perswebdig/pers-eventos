"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/auth/use-sign-out";

export function SignOutButton() {
  const { signOut, saindo } = useSignOut();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sair"
      title="Sair"
      disabled={saindo}
      onClick={() => void signOut()}
    >
      <LogOut className="size-4" />
    </Button>
  );
}
