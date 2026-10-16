import { cn } from "cn";

export function Donut({
  segments,
  size = 148,
  thickness = 14,
  centerValue,
  centerLabel,
  legend = true,
  className,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerValue?: React.ReactNode;
  centerLabel?: React.ReactNode;
  legend?: boolean;
  className?: string;
}) {
  const total = segments.reduce((acc, segment) => acc + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="stroke-muted"
          />
          {total > 0 &&
            segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{centerValue ?? total}</span>
          {centerLabel ? (
            <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
          ) : null}
        </div>
      </div>
      {legend ? (
        <ul className="min-w-40 flex-1 space-y-1.5 text-sm">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: segment.color }}
              />
              <span className="truncate text-muted-foreground">{segment.label}</span>
              <span className="ml-auto pl-2 font-medium tabular-nums">{segment.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BarList({
  items,
  max,
  formatValue,
  className,
}: {
  items: { label: React.ReactNode; value: number; hint?: React.ReactNode; colorClass?: string }[];
  max?: number;
  formatValue?: (value: number) => React.ReactNode;
  className?: string;
}) {
  const peak = max ?? Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, index) => (
        <li key={typeof item.label === "string" ? item.label : index} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatValue ? formatValue(item.value) : item.value}
              {item.hint ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {item.hint}
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary", item.colorClass)}
              style={{ width: `${Math.min(100, (item.value / peak) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const coords = values.map(
    (value, index) => [index * stepX, height - ((value - min) / span) * (height - 6) - 3] as const,
  );
  const points = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `M0,${height} L${coords.map(([x, y]) => `${x},${y}`).join(" L")} L${width},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-primary", className)}
      aria-hidden
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
