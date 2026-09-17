"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";

const NAV = [
  {
    section: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    section: "Operations Hub",
    items: [
      { label: "Failed Deliveries", href: "/operations/failed-deliveries" },
      { label: "In-Transit Stock", href: "/operations/in-transit" },
      { label: "Whales (VIP)", href: "/operations/whales" },
      { label: "Bulk Orders", href: "/operations/bulk-orders" },
      { label: "Barcode Readiness", href: "/operations/barcodes" },
      { label: "Inventory Scanner", href: "/operations/scanner" },
      { label: "Per-Product Profit", href: "/operations/products" },
      { label: "Shipping Reconciliation", href: "/operations/shipping-reconciliation" },
    ],
  },
  {
    section: "Returns (Estabdali)",
    items: [
      { label: "Requests Inbox", href: "/returns-admin/inbox" },
      { label: "Processing Queue", href: "/returns-admin/processing" },
      { label: "Feedback & Analysis", href: "/returns-admin/analysis" },
      { label: "Policy Engine", href: "/returns-admin/policy" },
      { label: "Portal Branding", href: "/returns-admin/portal-settings" },
    ],
  },
  {
    section: "Cross-module",
    items: [{ label: "Return Scanner", href: "/return-scanner" }],
  },
  {
    section: "Utility",
    items: [
      { label: "Export", href: "/export" },
      { label: "Settings", href: "/settings" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 py-5 border-b border-neutral-200">
        <p className="font-semibold">OldStar Ops</p>
        <p className="text-xs text-neutral-500">Internal tool</p>
      </div>
      <nav className="px-3 py-4 space-y-6">
        {NAV.map((section) => (
          <div key={section.section}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "block rounded-md px-2 py-1.5 text-sm",
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 pb-5">
        <button
          onClick={logout}
          className="w-full text-left rounded-md px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
