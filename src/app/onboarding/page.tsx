"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Users, Building2, Mail, Shield, CheckCircle2, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { createClient } from "../../lib/supabase/client";
import { isSupabaseConfigured } from "../../lib/env";
import { slugify } from "../../features/admin/estabelecimento-schema";

const onboardingSchema = z.object({
  // Estabelecimento
  estabelecimento_nome: z.string().trim().min(3, "Nome do estabelecimento (mín. 3 letras)"),
  estabelecimento_slug: z.string().trim().min(2, "Identificador único").regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  estabelecimento_cnpj: z.string().trim().optional(),
  estabelecimento_email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  estabelecimento_telefone: z.string().trim().optional(),
  estabelecimento_endereco: z.string().trim().optional(),
  estabelecimento_cidade: z.string().trim().optional(),
  estabelecimento_estado: z.string().trim().max(2, "Sigla do estado (ex.: SP)").optional(),

  // Convite de equipe
  convites: z.array(z.object({
    email: z.string().trim().email("E-mail inválido"),
    papel: z.enum(["tenant_admin", "staff"]),
    nome: z.string().trim().min(2, "Nome completo"),
  })).optional(),

  // Primeiro evento
  primeiro_evento_nome: z.string().trim().min(3, "Nome do evento").optional(),
  primeiro_evento_data: z.string().trim().optional(),
  primeiro_evento_local: z.string().trim().optional(),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

function traduzirErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate") || m.includes("already exists")) return "Já existe um registro com este valor único.";
  if (m.includes("invalid")) return "Dados inválidos.";
  return message;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [estabelecimentoId, setEstabelecimentoId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      estabelecimento_nome: "",
      estabelecimento_slug: "",
      estabelecimento_cnpj: "",
      estabelecimento_email: "",
      estabelecimento_telefone: "",
      estabelecimento_endereco: "",
      estabelecimento_cidade: "",
      estabelecimento_estado: "",
      convites: [] as Array<{ email: string; papel: "tenant_admin" | "staff"; nome: string }>,
      primeiro_evento_nome: "",
      primeiro_evento_data: "",
      primeiro_evento_local: "",
    },
    mode: "onBlur",
  });

  const nomeEstabelecimento = watch("estabelecimento_nome");
  const slugEstabelecimento = watch("estabelecimento_slug");

  useEffect(() => {
    if (nomeEstabelecimento && !slugEstabelecimento) {
      setValue("estabelecimento_slug", slugify(nomeEstabelecimento));
    }
  }, [nomeEstabelecimento, slugEstabelecimento, setValue]);

  async function onSubmitEtapa1(values: Partial<OnboardingValues>) {
    if (!isSupabaseConfigured) return;
    setSalvando(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("estabelecimentos")
        .insert({
          nome: values.estabelecimento_nome!.trim(),
          slug: values.estabelecimento_slug!.trim(),
          cnpj: values.estabelecimento_cnpj?.trim() || null,
          email: values.estabelecimento_email?.trim() || null,
          telefone: values.estabelecimento_telefone?.trim() || null,
          endereco: values.estabelecimento_endereco?.trim() || null,
          cidade: values.estabelecimento_cidade?.trim() || null,
          estado: values.estabelecimento_estado?.trim().toUpperCase() || null,
          ativo: true,
        })
        .select("id")
        .single();

      if (error) throw error;
      setEstabelecimentoId(data.id);
      setEtapa(2);
      toast.success("Estabelecimento criado!");
    } catch (err) {
      toast.error("Falha ao criar estabelecimento", { description: traduzirErro((err as Error).message) });
    } finally {
      setSalvando(false);
    }
  }

  async function onSubmitEtapa2(values: Partial<OnboardingValues>) {
    if (!estabelecimentoId || !isSupabaseConfigured) return;
    setSalvando(true);
    try {
      const supabase = createClient();
      const convites = values.convites ?? [];

      for (const convite of convites) {
        const { error } = await supabase.auth.admin.inviteUserByEmail(convite.email, {
          data: { nome: convite.nome, tenant_id: estabelecimentoId, papel: convite.papel },
        });
        if (error) throw error;
      }

      if (values.primeiro_evento_nome) {
        const { error } = await supabase
          .from("eventos")
          .insert({
            tenant_id: estabelecimentoId,
            nome: values.primeiro_evento_nome!.trim(),
            descricao: "",
            data_inicio: values.primeiro_evento_data || new Date().toISOString().split("T")[0],
            local: values.primeiro_evento_local || "",
            capacidade: null,
            status: "planejado",
          });
        if (error) throw error;
      }

      toast.success("Onboarding concluído!");
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      toast.error("Falha ao concluir onboarding", { description: traduzirErro((err as Error).message) });
    } finally {
      setSalvando(false);
    }
  }

  const etapas = [
    { num: 1, label: "Estabelecimento", icon: Building2, desc: "Dados do seu espaço" },
    { num: 2, label: "Equipe", icon: Users, desc: "Convide admin/staff" },
    { num: 3, label: "Primeiro evento", icon: CalendarDays, desc: "Opcional" },
    { num: 4, label: "Concluir", icon: CheckCircle2, desc: "Finalizar" },
  ];

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-6">
        <Card className="w-full">
          <CardContent className="space-y-3 py-6">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-500">
                Supabase não configurado
              </p>
              <p className="mt-1 text-muted-foreground">
                Configure as variáveis de ambiente para usar o onboarding.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center px-6 py-12">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex items-center gap-2">
              {etapas.map((e, i) => (
                <div key={e.num} className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      i + 1 < etapa ? "bg-green-600 text-white" :
                      i + 1 === etapa ? "bg-green-600 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1 < etapa ? <CheckCircle2 className="size-4" /> : e.num}
                  </div>
                  {i < etapas.length - 1 && <div className="hidden w-16 h-0.5 bg-muted sm:block" />}
                </div>
              ))}
            </div>
          </div>
          <CardTitle>Bem-vindo ao PersEventos!</CardTitle>
          <CardDescription>
            Vamos configurar seu estabelecimento em {etapas.length} etapas rápidas.
            Etapa {etapa} de {etapas.length}: {etapas[etapa - 1].label}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {etapa === 1 && (
            <form onSubmit={handleSubmit(onSubmitEtapa1)} className="grid gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-5" />
                <h3 className="font-medium">Dados do estabelecimento</h3>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="estabelecimento_nome">Nome *</Label>
                <Input
                  id="estabelecimento_nome"
                  autoComplete="organization"
                  {...register("estabelecimento_nome")}
                  placeholder="Ex.: Sítio Vale Verde"
                />
                {errors.estabelecimento_nome && <p className="text-xs text-destructive">{errors.estabelecimento_nome.message}</p>}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="estabelecimento_slug">Identificador (slug) *</Label>
                <Input
                  id="estabelecimento_slug"
                  {...register("estabelecimento_slug")}
                  placeholder="sitio-vale-verde"
                  readOnly={!!slugEstabelecimento}
                />
                <p className="text-xs text-muted-foreground">Gerado automaticamente do nome. Usado em URLs internas.</p>
                {errors.estabelecimento_slug && <p className="text-xs text-destructive">{errors.estabelecimento_slug.message}</p>}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="estabelecimento_cnpj">CNPJ</Label>
                <Input
                  id="estabelecimento_cnpj"
                  placeholder="00.000.000/0000-00"
                  {...register("estabelecimento_cnpj")}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="estabelecimento_email">E-mail de contato</Label>
                <Input
                  id="estabelecimento_email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="contato@exemplo.com"
                  {...register("estabelecimento_email")}
                />
                {errors.estabelecimento_email && <p className="text-xs text-destructive">{errors.estabelecimento_email.message}</p>}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="estabelecimento_telefone">Telefone</Label>
                <Input
                  id="estabelecimento_telefone"
                  placeholder="(11) 99999-9999"
                  {...register("estabelecimento_telefone")}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="estabelecimento_endereco">Endereço</Label>
                <Input
                  id="estabelecimento_endereco"
                  placeholder="Rua das Flores, 123"
                  {...register("estabelecimento_endereco")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="estabelecimento_cidade">Cidade</Label>
                  <Input id="estabelecimento_cidade" {...register("estabelecimento_cidade")} placeholder="São Paulo" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="estabelecimento_estado">Estado</Label>
                  <Input id="estabelecimento_estado" maxLength={2} {...register("estabelecimento_estado")} placeholder="SP" />
                  {errors.estabelecimento_estado && <p className="text-xs text-destructive">{errors.estabelecimento_estado.message}</p>}
                </div>
              </div>

              <Button type="submit" disabled={salvando} className="w-full">
                {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Próximo: Equipe
              </Button>
            </form>
          )}

          {etapa === 2 && (
            <form onSubmit={handleSubmit(onSubmitEtapa2)} className="grid gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-5" />
                <h3 className="font-medium">Convidar equipe</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Adicione administradores e recepcionistas. Eles receberão e-mail para definir senha.
              </p>

              <ConvitesForm register={register} watch={watch} />

              <Button type="button" variant="outline" onClick={() => setEtapa(3)} className="w-full">
                Pular: Criar primeiro evento
              </Button>
            </form>
          )}

          {etapa === 3 && (
            <form onSubmit={handleSubmit(onSubmitEtapa2)} className="grid gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-5" />
                <h3 className="font-medium">Primeiro evento (opcional)</h3>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="primeiro_evento_nome">Nome do evento</Label>
                <Input id="primeiro_evento_nome" {...register("primeiro_evento_nome")} placeholder="Retiro de Primavera" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="primeiro_evento_data">Data de início</Label>
                  <Input id="primeiro_evento_data" type="date" {...register("primeiro_evento_data")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="primeiro_evento_local">Local</Label>
                  <Input id="primeiro_evento_local" {...register("primeiro_evento_local")} placeholder="Sítio Vale Verde" />
                </div>
              </div>

              <Button type="button" variant="outline" onClick={() => setEtapa(2)} className="w-full">
                Voltar
              </Button>
            </form>
          )}

          {etapa === 4 && (
            <form onSubmit={handleSubmit(onSubmitEtapa2)} className="grid gap-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="size-6" />
                <h3 className="text-lg font-medium">Tudo pronto!</h3>
              </div>
              <p className="text-muted-foreground">
                Seu estabelecimento foi criado, a equipe foi convidada e o primeiro evento agendado.
              </p>
              <Button type="submit" disabled={salvando} className="w-full bg-green-600 hover:bg-green-700">
                {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Finalizar e ir para o painel
              </Button>
            </form>
          )}

          <Separator />
          <nav className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setEtapa((p) => Math.max(1, p - 1))}
              disabled={etapa === 1 || salvando}
            >
              Voltar
            </Button>
            <Button
              onClick={() => setEtapa((p) => Math.min(etapas.length, p + 1))}
              disabled={etapa === etapas.length || salvando}
            >
              Próximo
            </Button>
          </nav>
        </CardContent>
      </Card>
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ConvitesForm({ register, watch }: { register: any; watch: any }) {
  const [convites, setConvites] = useState<Array<{ email: string; papel: "tenant_admin" | "staff"; nome: string }>>([]);

  function adicionarConvite() {
    setConvites([...convites, { email: "", papel: "staff", nome: "" }]);
  }

  function removerConvite(idx: number) {
    setConvites(convites.filter((_, i) => i !== idx));
  }

  function atualizarConvite(idx: number, field: keyof typeof convites[0], value: string) {
    setConvites(convites.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  return (
    <div className="space-y-3">
      {convites.length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground/20 p-4 text-center text-muted-foreground">
          Nenhum convite adicionado.
        </div>
      )}
      {convites.map((c, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder="Nome completo"
            value={c.nome}
            onChange={(e) => atualizarConvite(i, "nome", e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="E-mail"
            type="email"
            inputMode="email"
            value={c.email}
            onChange={(e) => atualizarConvite(i, "email", e.target.value)}
            className="flex-1"
          />
          <select
            value={c.papel}
            onChange={(e) => atualizarConvite(i, "papel", e.target.value as "tenant_admin" | "staff")}
            className="w-36 rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="staff">Recepção</option>
            <option value="tenant_admin">Admin</option>
          </select>
          <Button type="button" variant="ghost" size="icon" onClick={() => removerConvite(i)}>
            <X className="size-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={adicionarConvite} className="w-full">
        <Users className="mr-2 size-4" /> Adicionar convite
      </Button>
    </div>
  );
}