"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/12 text-destructive ring-1 ring-destructive/25">
            <TriangleAlert className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado. Tente novamente — seus dados locais estão seguros.
          </p>
          {error.digest ? (
            <p className="font-mono text-[10px] text-muted-foreground/70">ref: {error.digest}</p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => reset()}>
              <RotateCcw className="size-4" /> Tentar novamente
            </Button>
            <Button variant="outline" render={<Link href="/">Ir para o início</Link>} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
