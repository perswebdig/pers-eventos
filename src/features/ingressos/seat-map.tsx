"use client";

import { cn } from "cn";
import { agruparPorFileira, rotuloAssento, type AssentoMapa } from "./assentos";

// Mapa de lugares em grade (fileiras × cadeiras). Usado pelo portal (escolha
// de lugares) e pelo admin (visualização de ocupação).
export function SeatMap({
  assentos,
  selecionados,
  onToggle,
  readOnly = false,
  className,
}: {
  assentos: AssentoMapa[];
  selecionados?: ReadonlySet<string>;
  onToggle?: (assentoId: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const fileiras = agruparPorFileira(assentos);

  return (
    <div className={cn("space-y-2 overflow-x-auto", className)}>
      {fileiras.map(({ fileira, assentos: cadeiras }) => (
        <div key={fileira} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center font-mono text-xs font-medium text-muted-foreground">
            {fileira}
          </span>
          <div className="flex gap-1">
            {cadeiras.map((assento) => {
              const selecionado = selecionados?.has(assento.id) ?? false;
              const ocupado = assento.status !== "livre";
              return (
                <button
                  key={assento.id}
                  type="button"
                  disabled={readOnly || ocupado}
                  aria-pressed={readOnly ? undefined : selecionado}
                  aria-label={`Fileira ${fileira}, cadeira ${assento.numero} — ${
                    assento.status === "livre"
                      ? selecionado
                        ? "selecionada"
                        : "livre"
                      : assento.status
                  }`}
                  title={rotuloAssento(fileira, assento.numero)}
                  onClick={() => onToggle?.(assento.id)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-medium tabular-nums transition-colors",
                    selecionado
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50 hover:bg-primary/10",
                    assento.status === "reservado" &&
                      "border-warning/40 bg-warning/15 text-warning",
                    assento.status === "vendido" &&
                      "border-border bg-muted text-muted-foreground line-through",
                    readOnly && "cursor-default",
                  )}
                >
                  {assento.numero}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SeatMapLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-4 text-xs text-muted-foreground", className)}>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded border border-border" /> Livre
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded border border-primary bg-primary" /> Selecionada
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded border border-warning/40 bg-warning/15" /> Reservada
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded border border-border bg-muted" /> Vendida
      </span>
    </div>
  );
}
