import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PagePlaceholder({
  icon: Icon,
  title,
  description,
  passo,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  passo: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-5" aria-hidden />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Em construção · {passo}
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
