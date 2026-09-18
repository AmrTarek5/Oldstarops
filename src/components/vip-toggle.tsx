"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VipToggle({
  email,
  name,
  isVip,
}: {
  email: string;
  name: string | null;
  isVip: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/vip/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, isVip: !isVip }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50 hover:bg-neutral-50"
    >
      {isVip ? "Unflag VIP" : "Flag VIP"}
    </button>
  );
}
