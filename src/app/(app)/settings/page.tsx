import { PageHeader, Card } from "@/components/ui";
import ConnectionTest from "@/components/connection-test";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Account, store, and integration status" />

      <div className="grid gap-6 max-w-2xl">
        <ConnectionTest />

        <Card title="Store">
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Shopify domain</dt>
              <dd className="font-medium">{process.env.SHOPIFY_STORE_DOMAIN || "not set"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Admin account</dt>
              <dd className="font-medium">{process.env.ADMIN_EMAIL || "not set"}</dd>
            </div>
          </dl>
        </Card>

        <Card title="About">
          <p className="text-sm text-neutral-500">
            OldStar Operations & Returns App — private internal tool. Sync jobs run on Vercel
            Cron; see <code className="text-xs bg-neutral-100 px-1 py-0.5 rounded">vercel.json</code>{" "}
            for schedule.
          </p>
        </Card>
      </div>
    </div>
  );
}
