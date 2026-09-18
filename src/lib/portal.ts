import { supabaseAdmin } from "@/lib/supabase/server";
import type { PortalSettingsRow } from "@/lib/types";

export async function getPortalSettings(): Promise<PortalSettingsRow> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("portal_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as PortalSettingsRow;
}

export async function updatePortalSettings(
  patch: Partial<Omit<PortalSettingsRow, "id" | "updated_at">>
) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("portal_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw error;
}
