"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatNumber } from "@/lib/format";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  with_bosta: "With Bosta",
  out_for_delivery: "Out for delivery",
  heading_back: "Heading back",
};

export interface FunnelDatum {
  status: string;
  count: number;
  codSum: number;
}

export default function DeliveryFunnelChart({ data }: { data: FunnelDatum[] }) {
  const chartData = data.map((d) => ({
    stage: STAGE_LABELS[d.status] ?? d.status,
    count: d.count,
    codSum: d.codSum,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="stage" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            formatter={(value, name) =>
              name === "codSum"
                ? [formatMoney(Number(value)), "COD value"]
                : [formatNumber(Number(value)), "Orders"]
            }
          />
          <Bar dataKey="count" fill="#111827" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
