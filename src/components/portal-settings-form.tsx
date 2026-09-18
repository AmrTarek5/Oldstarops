"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { PortalSettingsRow } from "@/lib/types";

export default function PortalSettingsForm({ settings }: { settings: PortalSettingsRow }) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondary_color);
  const [policyText, setPolicyText] = useState(settings.policy_text ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/portal-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          policy_text: policyText,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Returns portal branding" className="max-w-xl">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Primary color</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-16 rounded border border-neutral-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Secondary color</label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-16 rounded border border-neutral-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Return policy text (shown to customers)</label>
          <textarea
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save branding"}
        </button>
        {saved && <span className="ml-3 text-sm text-emerald-600">Saved</span>}
      </form>
    </Card>
  );
}
