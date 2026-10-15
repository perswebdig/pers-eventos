import Link from "next/link";
import { Building2, CalendarDays, CheckCircle2, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "../../lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Super Admin" };

async function contar(tabela: "estabelecimentos" | "pessoas" | "eventos") {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from(tabela)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminIndexPage() {
  await requireRole(["super_admin"]);

  const [totalZgt, totalPessoas, totalEventos] = await Promise.all([
    contar("estabelecimentos"),
    contar("pessoas"),
    contar("eventos"),
  ]);

  const cards = [
    { label: "Estabelecimentos", value: totalZgt, icon: Building2 },
    { label: "Pessoas (global)", value: totalPessoas, icon: Users },
    { label: "Eventos (global)", value: totalEventos, icon: CalendarDays },
    { label: "Plataforma", value: "Ativa", icon: CheckCircle2 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Visão geral da plataforma</h1>
          <p className="text-sm text-muted-foreground">
            Métricas globais e gestão dos estabelecimentos (tenants).
          </p>
        </div>
        <Button render={<Link href="/admin/estabelecimentos">Gerenciar estabelecimentos</Link>}>
          Gerenciar estabelecimentos
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              <c.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
