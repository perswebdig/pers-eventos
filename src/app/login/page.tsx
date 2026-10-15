import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
      <Suspense
        fallback={
          <Card className="w-full">
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        }
      >
        <AuthForm />
      </Suspense>
    </main>
  );
}
