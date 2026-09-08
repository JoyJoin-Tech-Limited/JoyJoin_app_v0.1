export function getCurrencySymbol(city: "香港" | "深圳" | string): string {
  return city === "香港" ? "HK$" : "¥";
}

export function formatPrice(price: string, city: "香港" | "深圳" | string): string {
  const symbol = getCurrencySymbol(city);
  return `${symbol}${price}`;
}

export function formatMoneyCents(cents: number | null | undefined): string {
  const safeCents = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  return `¥${(safeCents / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
