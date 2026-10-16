"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PessoaForm } from "@/features/pessoas/pessoa-form";
import { toPessoaFormValues, type PessoaFormValues } from "@/features/pessoas/pessoa-schema";
import type { Pessoa } from "@/types/database";

// Formulário de autoatendimento do cliente (cria/edita a própria pessoa).
export function PortalPerfilForm() {
  const router = useRouter();
  const [values, setValues] = useState<PessoaFormValues | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/portal/perfil")
      .then((r) => r.json())
      .then((body: { data?: { pessoa?: Record<string, unknown> } }) => {
        if (!ativo) return;
        setValues(toPessoaFormValues((body.data?.pessoa ?? {}) as Partial<Pessoa>));
      })
      .catch(() => {
        if (ativo) setValues(toPessoaFormValues({} as Partial<Pessoa>));
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function onSubmit(v: PessoaFormValues) {
    const res = await fetch("/api/portal/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error("Não foi possível salvar", {
        description: body.error ?? "Verifique os dados.",
      });
      return;
    }
    toast.success("Dados salvos");
    router.push("/portal");
    router.refresh();
  }

  if (!values) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <PessoaForm
      defaultValues={values}
      onSubmit={onSubmit}
      onCancel={() => router.push("/portal")}
    />
  );
}
