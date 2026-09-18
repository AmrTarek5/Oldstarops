import { PageHeader } from "@/components/ui";
import SetupNotice from "@/components/setup-notice";
import ReturnsInbox from "@/components/returns-inbox";
import { getReturnRequests } from "@/lib/returns";
import type { ReturnRequestRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReturnsInboxPage() {
  let requests: ReturnRequestRow[] = [];
  let error: string | null = null;
  try {
    requests = await getReturnRequests(["under_review"]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div>
      <PageHeader title="Requests Inbox" description={error ? undefined : `${requests.length} awaiting review`} />
      {error ? <SetupNotice error={error} /> : <ReturnsInbox requests={requests} />}
    </div>
  );
}
