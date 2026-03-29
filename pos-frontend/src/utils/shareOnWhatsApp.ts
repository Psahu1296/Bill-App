import type { Order } from "../types";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.startsWith("0") && digits.length === 11) return "91" + digits.slice(1);
  return digits;
}

export function shareOnWhatsApp(order: Order): void {
  const { customerDetails, items, bills, amountPaid, paymentMethod, orderDate, table, _id, orderType } = order;

  const date = new Date(orderDate).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalSaved = items.reduce((acc, item) => {
    if (item.markedPricePerQuantity != null && item.markedPricePerQuantity > item.pricePerQuantity) {
      return acc + (item.markedPricePerQuantity - item.pricePerQuantity) * item.quantity;
    }
    return acc;
  }, 0);

  const itemLines = items
    .map((item) => {
      const size = item.variantSize ? ` (${item.variantSize})` : "";
      const hasMrp = item.markedPricePerQuantity != null && item.markedPricePerQuantity > item.pricePerQuantity;
      if (hasMrp) {
        const mrpTotal = (item.markedPricePerQuantity! * item.quantity).toFixed(2);
        return `  ${item.quantity}x ${item.name}${size}  ~\u20B9${mrpTotal}~ \u20B9${item.price.toFixed(2)}`;
      }
      return `  ${item.quantity}x ${item.name}${size}  \u20B9${item.price.toFixed(2)}`;
    })
    .join("\n");

  const tableInfo = table
    ? `Table T-${table.tableNo}`
    : orderType
    ? orderType.charAt(0).toUpperCase() + orderType.slice(1)
    : "Takeaway";

  let billLines = `Subtotal:  \u20B9${bills.total.toFixed(2)}`;
  if (bills.discount) billLines += `\nDiscount:  -\u20B9${bills.discount.toFixed(2)}`;
  if (bills.roundOff) billLines += `\nRound Off: ${bills.roundOff > 0 ? "+" : ""}\u20B9${bills.roundOff.toFixed(2)}`;
  billLines += `\n*Total:    \u20B9${bills.totalWithTax.toFixed(2)}*`;
  billLines += `\nPaid:      \u20B9${(amountPaid || 0).toFixed(2)} (${paymentMethod})`;

  const balance = Math.max(0, bills.totalWithTax - (amountPaid || 0));
  if (balance > 0) billLines += `\nBalance:   \u20B9${balance.toFixed(2)}`;

  const savingsLine = totalSaved > 0
    ? `*\uD83C\uDF89 You saved \u20B9${totalSaved.toFixed(0)} today!*`
    : null;

  const message = [
    `*\uD83C\uDF72 Sahu Family Dhaba*`,
    `Order #${_id.slice(-6).toUpperCase()} | ${date}`,
    `${customerDetails.name} | ${tableInfo}`,
    ``,
    `*Items:*`,
    itemLines,
    ``,
    billLines,
    ...(savingsLine ? [``, savingsLine] : []),
    ``,
    `_Thank you! Come again \u2764\uFE0F_`,
  ].join("\n");

  const encoded = encodeURIComponent(message);
  const phone = customerDetails.phone?.trim();
  const url =
    phone
      ? `https://wa.me/${formatPhone(phone)}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

  window.open(url, "_blank");
}
