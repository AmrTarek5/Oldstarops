import clsx from "clsx";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("bg-white border border-neutral-200 rounded-xl p-5", className)}>
      {title && <h2 className="text-sm font-semibold text-neutral-700 mb-3">{title}</h2>}
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneClass = {
    default: "text-neutral-900",
    positive: "text-emerald-600",
    negative: "text-red-600",
    warning: "text-amber-600",
  }[tone];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>
      <p className={clsx("text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "warning" | "info";
}) {
  const toneClass = {
    default: "bg-neutral-100 text-neutral-700",
    positive: "bg-emerald-100 text-emerald-700",
    negative: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-blue-100 text-blue-700",
  }[tone];

  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", toneClass)}>
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-sm text-neutral-400 py-12 border border-dashed border-neutral-200 rounded-xl">
      {message}
    </div>
  );
}

export function Table({
  columns,
  children,
}: {
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {columns.map((c) => (
              <th key={c} className="py-2 px-3 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  );
}
