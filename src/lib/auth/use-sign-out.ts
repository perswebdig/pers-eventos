"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { wipeLocalDatabase } from "@/db/tenant";

export function useSignOut() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function signOut() {
    setSaindo(true);
    try {
      await createClient().auth.signOut();
      // Isolamento multitenant: apaga o cache local para que outra conta no
      // mesmo dispositivo não enxergue dados do estabelecimento anterior.
      await wipeLocalDatabase();
      toast.success("Sessão encerrada");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Não foi possível sair");
      setSaindo(false);
    }
  }

  return { signOut, saindo };
}
