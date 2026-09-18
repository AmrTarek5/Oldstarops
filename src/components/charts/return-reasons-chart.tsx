"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

export default function ReturnReasonsChart({
  data,
}: {
  data: Array<{ reason: string; count: number }>;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-neutral-400 py-8 text-center">No return requests in this range.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="reason"
            width={140}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <Tooltip formatter={(value) => [formatNumber(Number(value)), "Requests"]} />
          <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
