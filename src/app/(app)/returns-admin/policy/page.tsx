import { PageHeader } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import PolicyForm from "@/components/policy-form";
import { getReturnPolicy } from "@/lib/policy";
import type { ReturnPolicyRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  let policy: ReturnPolicyRow | null = null;
  let error: string | null = null;
  try {
    policy = await getReturnPolicy();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <PageHeader title="Policy Engine" description="Rules that auto-approve or auto-reject return requests" />
      {error || !policy ? <SetupNotice error={error ?? "Unknown error"} /> : <PolicyForm policy={policy} />}
    </div>
  );
}
