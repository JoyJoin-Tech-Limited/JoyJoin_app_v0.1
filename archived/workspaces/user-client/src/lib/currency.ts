export function getCurrencySymbol(city: "香港" | "深圳" | string): string {
  return city === "香港" ? "HK$" : "¥";
}

export function formatPrice(price: string, city: "香港" | "深圳" | string): string {
  const symbol = getCurrencySymbol(city);
  return `${symbol}${price}`;
}
