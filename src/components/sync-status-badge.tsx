import { CloudCheck, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/types/database";

const MAP: Record<SyncStatus, { label: string; icon: typeof CloudCheck; className: string }> = {
  synced: {
    label: "Sincronizado",
    icon: CloudCheck,
    className: "border-success/30 text-success",
  },
  pending: {
    label: "Pendente",
    icon: RefreshCw,
    className: "border-amber-600/30 text-amber-700 dark:text-amber-500",
  },
  conflict: {
    label: "Conflito",
    icon: TriangleAlert,
    className: "border-orange-600/30 text-orange-700 dark:text-orange-500",
  },
  error: {
    label: "Erro",
    icon: CloudOff,
    className: "border-destructive/30 text-destructive",
  },
};

export function SyncStatusBadge({
  status,
  withLabel = true,
  className,
}: {
  status: SyncStatus;
  withLabel?: boolean;
  className?: string;
}) {
  const { label, icon: Icon, className: tone } = MAP[status] ?? MAP.pending;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", tone, className)} title={label}>
      <Icon className="size-3" aria-hidden />
      {withLabel ? label : <span className="sr-only">{label}</span>}
    </Badge>
  );
}
