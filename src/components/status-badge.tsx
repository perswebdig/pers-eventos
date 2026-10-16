import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export const statusToneClass: Record<StatusTone, string> = {
  neutral: "border-border text-muted-foreground",
  primary: "border-primary/30 text-primary",
  success: "border-success/35 text-success",
  warning: "border-warning/40 text-warning",
  danger: "border-destructive/35 text-destructive",
  info: "border-info/35 text-info",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", statusToneClass[tone], className)}>
      {children}
    </Badge>
  );
}
