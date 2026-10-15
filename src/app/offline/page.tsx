"use client";

import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <Card className="w-full">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Você está offline</h1>
            <p className="text-muted-foreground">
              Esta página precisa de conexão, mas o restante do sistema continua
              funcionando. As alterações que você fizer serão salvas localmente e
              sincronizadas quando a internet voltar.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              render={<Link href="/dashboard" />}
            >
              Ir para o painel
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="size-4 mr-2" /> Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
