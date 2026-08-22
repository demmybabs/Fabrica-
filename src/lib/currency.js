export function formatMoney(amount, currency) {
  const symbol = currency?.symbol || "₦";
  const n = amount || 0;
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
