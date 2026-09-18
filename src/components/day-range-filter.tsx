import Link from "next/link";
import clsx from "clsx";

const OPTIONS = [7, 14, 21, 30];

export default function DayRangeFilter({
  basePath,
  activeDays,
}: {
  basePath: string;
  activeDays: number;
}) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
      {OPTIONS.map((days) => (
        <Link
          key={days}
          href={`${basePath}?days=${days}`}
          className={clsx(
            "px-3 py-1 rounded-md text-xs font-medium",
            days === activeDays ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
          )}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}
