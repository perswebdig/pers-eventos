import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

export type StatTone = "default" | "primary" | "success" | "warning" | "danger" | "info";

const TONES: Record<StatTone, { icon: string; bar: string }> = {
  default: { icon: "bg-muted text-muted-foreground", bar: "via-border" },
  primary: { icon: "bg-primary/12 text-primary", bar: "via-primary/70" },
  success: { icon: "bg-success/12 text-success", bar: "via-success/70" },
  warning: { icon: "bg-warning/12 text-warning", bar: "via-warning/70" },
  danger: { icon: "bg-destructive/12 text-destructive", bar: "via-destructive/70" },
  info: { icon: "bg-info/12 text-info", bar: "via-info/70" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  footer,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  href?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const toneStyles = TONES[tone];
  const card = (
    <Card
      className={cn(
        "relative h-full gap-3 py-4 transition-colors",
        href && "hover:ring-primary/30",
        className,
      )}
    >
      {tone !== "default" ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
            toneStyles.bar,
          )}
        />
      ) : null}
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              toneStyles.icon,
            )}
          >
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </CardContent>
      {footer ? <div className="px-(--card-spacing)">{footer}</div> : null}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus-visible:outline-none">
        {card}
      </Link>
    );
  }
  return card;
}
