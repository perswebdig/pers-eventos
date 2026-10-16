"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { formatCpf, formatTelefone } from "@/lib/format";
import { ehMenor } from "@/lib/format";
import { pessoaSchema, type PessoaFormValues } from "./pessoa-schema";

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

export function PessoaForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: PessoaFormValues;
  onSubmit: (values: PessoaFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const form = useForm<PessoaFormValues>({
    resolver: zodResolver(pessoaSchema),
    defaultValues,
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const dataNascimento = watch("data_nascimento");
  const menor = ehMenor(dataNascimento);

  return (
    <form
      onSubmit={handleSubmit(async (values) => onSubmit(values))}
      className="grid max-h-[70vh] gap-4 overflow-y-auto px-0.5"
      noValidate
    >
      <Field label="Nome completo *" htmlFor="nome_completo" error={errors.nome_completo?.message}>
        <Input id="nome_completo" autoComplete="name" {...register("nome_completo")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CPF" htmlFor="cpf" error={errors.cpf?.message}>
          <Input
            id="cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            {...register("cpf", {
              onChange: (e) =>
                setValue("cpf", formatCpf(e.target.value), { shouldValidate: false }),
            })}
          />
        </Field>
        <Field label="RG" htmlFor="rg" error={errors.rg?.message}>
          <Input id="rg" {...register("rg")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nascimento" htmlFor="data_nascimento" error={errors.data_nascimento?.message}>
          <Input id="data_nascimento" type="date" {...register("data_nascimento")} />
        </Field>
        <Field label="Telefone" htmlFor="telefone" error={errors.telefone?.message}>
          <Input
            id="telefone"
            inputMode="tel"
            placeholder="(00) 00000-0000"
            {...register("telefone", {
              onChange: (e) =>
                setValue("telefone", formatTelefone(e.target.value), { shouldValidate: false }),
            })}
          />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
        </Field>
      </div>

      <Field label="Endereço" htmlFor="endereco" error={errors.endereco?.message}>
        <Input id="endereco" {...register("endereco")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contato de emergência" htmlFor="contato_emergencia_nome">
          <Input id="contato_emergencia_nome" {...register("contato_emergencia_nome")} />
        </Field>
        <Field label="Telefone de emergência" htmlFor="contato_emergencia_telefone">
          <Input
            id="contato_emergencia_telefone"
            inputMode="tel"
            {...register("contato_emergencia_telefone", {
              onChange: (e) =>
                setValue("contato_emergencia_telefone", formatTelefone(e.target.value), {
                  shouldValidate: false,
                }),
            })}
          />
        </Field>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Restrições alimentares" htmlFor="restricoes_alimentares">
          <Input id="restricoes_alimentares" {...register("restricoes_alimentares")} />
        </Field>
        <Field label="Condições de saúde" htmlFor="condicoes_saude">
          <Input id="condicoes_saude" {...register("condicoes_saude")} />
        </Field>
        <Field label="Medicações" htmlFor="medicacoes">
          <Input id="medicacoes" {...register("medicacoes")} />
        </Field>
      </div>

      <Field label="Observações" htmlFor="observacoes">
        <Textarea id="observacoes" rows={2} {...register("observacoes")} />
      </Field>

      {menor ? (
        <>
          <Separator />
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-500">
              Visitante menor de 18 anos — dados do responsável são obrigatórios.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome do responsável *"
                htmlFor="responsavel_nome"
                error={errors.responsavel_nome?.message}
              >
                <Input id="responsavel_nome" {...register("responsavel_nome")} />
              </Field>
              <Field
                label="CPF do responsável *"
                htmlFor="responsavel_cpf"
                error={errors.responsavel_cpf?.message}
              >
                <Input
                  id="responsavel_cpf"
                  inputMode="numeric"
                  {...register("responsavel_cpf", {
                    onChange: (e) =>
                      setValue("responsavel_cpf", formatCpf(e.target.value), {
                        shouldValidate: false,
                      }),
                  })}
                />
              </Field>
            </div>
          </div>
        </>
      ) : null}

      <Separator />

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="consentimento_lgpd"
          render={({ field }) => (
            <Checkbox
              id="consentimento_lgpd"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked)}
              aria-invalid={!!errors.consentimento_lgpd}
            />
          )}
        />
        <div>
          <Label htmlFor="consentimento_lgpd" className="text-sm font-normal">
            O titular consente com o tratamento dos dados pessoais para as finalidades das vivências
            (LGPD).
          </Label>
          {errors.consentimento_lgpd ? (
            <p className="text-xs text-destructive">{errors.consentimento_lgpd.message}</p>
          ) : null}
        </div>
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
