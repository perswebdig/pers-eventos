"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {children}
    </div>
  );
}

export function ToolbarSearch({
  value,
  onValueChange,
  placeholder = "Buscar…",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative sm:max-w-xs sm:flex-1", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

export function ToolbarSpacer() {
  return <div className="hidden sm:block sm:flex-1" />;
}
