import Link from "next/link";
import clsx from "clsx";

const DEFAULT_OPTIONS = [7, 14, 21, 30];

export default function DayRangeFilter({
  basePath,
  activeDays,
  options = DEFAULT_OPTIONS,
}: {
  basePath: string;
  activeDays: number;
  /** Use 0 for an "All time" option. */
  options?: number[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
      {options.map((days) => (
        <Link
          key={days}
          href={days === 0 ? basePath : `${basePath}?days=${days}`}
          className={clsx(
            "px-3 py-1 rounded-md text-xs font-medium",
            days === activeDays ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          {days === 0 ? "All time" : `${days}d`}
        </Link>
      ))}
    </div>
  );
}
