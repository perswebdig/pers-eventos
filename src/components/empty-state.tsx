"use client";

import {
  Search,
  Users,
  CalendarDays,
  FileText,
  ClipboardList,
  Activity,
  Database,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: "search" | "users" | "calendar" | "file" | "clipboard" | "activity" | "database";
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}

const ICONS = {
  search: Search,
  users: Users,
  calendar: CalendarDays,
  file: FileText,
  clipboard: ClipboardList,
  activity: Activity,
  database: Database,
};

export function EmptyState({
  icon = "users",
  title,
  description,
  actions,
  className,
}: EmptyStateProps) {
  const Icon = ICONS[icon];
  return (
    <Card className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}>
      <CardContent className="flex flex-col items-center gap-3 w-full pt-6">
        {Icon && (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-6" aria-hidden />
          </div>
        )}
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && (
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs mx-auto mt-2">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LoadingSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-2">
          <div className="h-16 w-full bg-muted rounded-lg" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
