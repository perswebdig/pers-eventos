"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  estabelecimentoSchema,
  slugify,
  type EstabelecimentoFormValues,
} from "./estabelecimento-schema";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function EstabelecimentoForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: EstabelecimentoFormValues;
  onSubmit: (values: EstabelecimentoFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<EstabelecimentoFormValues>({
    resolver: zodResolver(estabelecimentoSchema),
    defaultValues,
    mode: "onBlur",
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => onSubmit(values))}
      className="grid max-h-[70vh] gap-4 overflow-y-auto px-0.5"
      noValidate
    >
      <Field label="Nome *" htmlFor="nome" error={errors.nome?.message}>
        <Input
          id="nome"
          {...register("nome", {
            onBlur: (e) => {
              if (!getValues("slug")) {
                setValue("slug", slugify(e.target.value));
              }
            },
          })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Identificador (slug) *" htmlFor="slug" error={errors.slug?.message}>
          <Input id="slug" placeholder="ex.: sitio-vale-verde" {...register("slug")} />
        </Field>
        <Field label="CNPJ" htmlFor="cnpj">
          <Input id="cnpj" {...register("cnpj")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" {...register("email")} />
        </Field>
        <Field label="Telefone" htmlFor="telefone">
          <Input id="telefone" {...register("telefone")} />
        </Field>
      </div>

      <Field label="Endereço" htmlFor="endereco">
        <Input id="endereco" {...register("endereco")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cidade" htmlFor="cidade">
          <Input id="cidade" {...register("cidade")} />
        </Field>
        <Field label="Estado (UF)" htmlFor="estado" error={errors.estado?.message}>
          <Input id="estado" maxLength={2} {...register("estado")} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Estabelecimento ativo</p>
          <p className="text-xs text-muted-foreground">
            Inativos não podem operar eventos nem receber clientes.
          </p>
        </div>
        <Controller
          control={control}
          name="ativo"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
          )}
        />
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-popover pt-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </form>
  );
}
