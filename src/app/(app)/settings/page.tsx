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
            <div className="flex justify-between">
              <dt className="text-neutral-500">Cron protection</dt>
              <dd className="font-medium">{process.env.CRON_SECRET ? "Configured" : "Not set"}</dd>
            </div>
          </dl>
          <p className="text-xs text-neutral-400 mt-3">
            This is a single shared admin login for the OldStar team, not a per-user account
            system. To change the email or password, update{" "}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">ADMIN_EMAIL</code> /{" "}
            <code className="bg-neutral-100 px-1 py-0.5 rounded">ADMIN_PASSWORD</code> in the
            deployment&apos;s environment variables and redeploy.
          </p>
        </Card>

        <Card title="Returns portal">
          <p className="text-sm text-neutral-500">
            Return policy rules and portal branding live under Returns (Estabdali) →{" "}
            <a href="/returns-admin/policy" className="underline">
              Policy Engine
            </a>{" "}
            and{" "}
            <a href="/returns-admin/portal-settings" className="underline">
              Portal Branding
            </a>
            .
          </p>
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
