const currencyFormatter = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number) {
  return currencyFormatter.format(amount || 0);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n || 0);
}

export function formatPercent(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
