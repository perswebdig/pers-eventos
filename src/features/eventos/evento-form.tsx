"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENTO_STATUS, eventoFormSchema, type EventoFormValues } from "./evento-schema";

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

export function EventoForm({
  defaultValues,
  onSubmit,
  onCancel,
}: {
  defaultValues: EventoFormValues;
  onSubmit: (values: EventoFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EventoFormValues>({
    resolver: zodResolver(eventoFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => onSubmit(values))}
      className="grid max-h-[70vh] gap-4 overflow-y-auto px-0.5"
      noValidate
    >
      <Field label="Nome do evento *" htmlFor="nome" error={errors.nome?.message}>
        <Input id="nome" {...register("nome")} />
      </Field>

      <Field label="Descrição" htmlFor="descricao">
        <Textarea id="descricao" rows={2} {...register("descricao")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início *" htmlFor="data_inicio" error={errors.data_inicio?.message}>
          <Input id="data_inicio" type="date" {...register("data_inicio")} />
        </Field>
        <Field label="Término" htmlFor="data_fim" error={errors.data_fim?.message}>
          <Input id="data_fim" type="date" {...register("data_fim")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Local" htmlFor="local" error={errors.local?.message}>
          <Input id="local" {...register("local")} />
        </Field>
        <Field label="Vagas" htmlFor="capacidade" error={errors.capacidade?.message}>
          <Input
            id="capacidade"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Ilimitado"
            {...register("capacidade")}
          />
        </Field>
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTO_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
