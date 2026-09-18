import { PageHeader } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import ProcessingQueue from "@/components/processing-queue";
import { getReturnRequests } from "@/lib/returns";
import type { ReturnRequestRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProcessingQueuePage() {
  let accepted: ReturnRequestRow[] = [];
  let processing: ReturnRequestRow[] = [];
  let error: string | null = null;
  try {
    [accepted, processing] = await Promise.all([
      getReturnRequests(["accepted"]),
      getReturnRequests(["processing"]),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <PageHeader title="Processing Queue" description="Track accepted items until received and completed" />
      {error ? <SetupNotice error={error} /> : <ProcessingQueue accepted={accepted} processing={processing} />}
    </div>
  );
}
