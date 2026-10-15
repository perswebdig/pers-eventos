"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Leaf, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "../../lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { APP_NAME } from "@/lib/constants";

const authSchema = z.object({
  nome: z.string().trim(),
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
});

type AuthValues = z.infer<typeof authSchema>;

// Traduz as mensagens mais comuns do Supabase Auth.
function traduzirErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha inválidos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Este e-mail já está cadastrado.";
  if (m.includes("password should be")) return "A senha precisa de ao menos 6 caracteres.";
  return message;
}

function AuthFields({ modo }: { modo: "signin" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { nome: "", email: "", password: "" },
    mode: "onBlur",
  });

  async function onSubmit(values: AuthValues) {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();

    if (modo === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        toast.error("Não foi possível entrar", { description: traduzirErro(error.message) });
        return;
      }
      toast.success("Bem-vindo de volta!");
      router.replace(redirectTo);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { nome: values.nome || values.email } },
    });
    if (error) {
      toast.error("Não foi possível criar a conta", {
        description: traduzirErro(error.message),
      });
      return;
    }
    if (!data.session) {
      toast.success("Conta criada", {
        description: "Confirme o e-mail que enviamos para poder entrar.",
      });
      return;
    }
    toast.success("Conta criada!");
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      {modo === "signup" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" autoComplete="name" {...register("nome")} />
          {errors.nome ? (
            <p className="text-xs text-destructive">{errors.nome.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete={modo === "signin" ? "current-password" : "new-password"}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting || !isSupabaseConfigured}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {modo === "signin" ? "Entrar" : "Criar conta"}
      </Button>
    </form>
  );
}

export function AuthForm() {
  const [modo, setModo] = useState<"signin" | "signup">("signin");

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-green-700 text-white">
          <Leaf className="size-5" aria-hidden />
        </div>
        <CardTitle>Entrar no {APP_NAME}</CardTitle>
        <CardDescription>
          Acesse com e-mail e senha. Seus dados ficam no dispositivo e sincronizam
          quando houver conexão.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!isSupabaseConfigured ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-500">
              Supabase não configurado
            </p>
            <p className="mt-1 text-muted-foreground">
              Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em <code>.env.local</code> e
              reinicie o servidor. Sem isso o app funciona apenas offline.
            </p>
            <Button
              variant="outline"
              className="mt-3"
              render={<Link href="/dashboard" />}
            >
              Continuar offline
            </Button>
          </div>
        ) : (
          <Tabs value={modo} onValueChange={(v) => setModo(v as "signin" | "signup")}>
            <TabsList className="w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="pt-4">
              <AuthFields modo="signin" />
            </TabsContent>
            <TabsContent value="signup" className="pt-4">
              <AuthFields modo="signup" />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
