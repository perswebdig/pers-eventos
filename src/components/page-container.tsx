import { cn } from "cn";

const WIDTHS = {
  app: "max-w-6xl",
  content: "max-w-3xl",
  form: "max-w-2xl",
} as const;

export function PageContainer({
  children,
  className,
  width = "app",
}: {
  children: React.ReactNode;
  className?: string;
  width?: keyof typeof WIDTHS;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 lg:px-6", WIDTHS[width], className)}>
      {children}
    </div>
  );
}
