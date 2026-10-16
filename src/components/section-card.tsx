import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {title ? (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
          {actions ? (
            <CardAction className="flex flex-wrap items-center justify-end gap-2">
              {actions}
            </CardAction>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(!title && "pt-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
