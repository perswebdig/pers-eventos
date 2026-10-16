import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

const ALIGN: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  empty,
  renderMobile,
  className,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  renderMobile?: (row: T) => React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {empty ?? "Nada por aqui ainda."}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(ALIGN[column.align ?? "left"], column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter") onRowClick(row);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  onRowClick &&
                    "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none",
                )}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(ALIGN[column.align ?? "left"], column.className)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick && "cursor-pointer active:bg-muted/60")}
          >
            {renderMobile ? (
              renderMobile(row)
            ) : (
              <dl className="space-y-1.5 p-4">
                {columns.map((column) => (
                  <div key={column.key} className="flex items-center justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">{column.header}</dt>
                    <dd className="text-sm">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
