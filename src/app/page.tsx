import Link from "next/link";
import { ArrowRight, Leaf, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-green-700 text-white">
        <Leaf className="size-8" aria-hidden />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{APP_NAME}</h1>
        <p className="text-balance text-muted-foreground">{APP_DESCRIPTION}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/dashboard" />}>
          Entrar no painel <ArrowRight className="size-4" />
        </Button>
        <Button variant="outline" render={<Link href="/offline" />}>
          <WifiOff className="size-4" /> Modo offline
        </Button>
      </div>
    </main>
  );
}
