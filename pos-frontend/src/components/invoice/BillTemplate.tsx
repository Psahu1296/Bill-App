import React from "react";
import type { Order } from "../../types";

interface Props { order: Order; }

const BillTemplate: React.FC<Props> = ({ order }) => {
  const date = new Date(order.orderDate).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const balanceDue = Math.max(0, order.bills.totalWithTax - (order.amountPaid || 0));

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "13px", maxWidth: "320px", margin: "0 auto", color: "#000", padding: "12px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>🍲 Sahu Family Dhaba</div>
        <div style={{ fontSize: "11px", color: "#555" }}>Thank you for dining with us!</div>
      </div>

      <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "8px 0" }} />

      {/* Order meta */}
      <div style={{ marginBottom: "4px" }}>
        <Row label="Order #" value={order._id.slice(-6).toUpperCase()} />
        <Row label="Date" value={date} />
        <Row label="Customer" value={order.customerDetails.name} />
        {order.customerDetails.phone && <Row label="Phone" value={order.customerDetails.phone} />}
        <Row label="Table" value={`T-${order.table?.tableNo ?? "N/A"}  |  Guests: ${order.customerDetails.guests}`} />
      </div>

      <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "8px 0" }} />

      {/* Items */}
      <div style={{ fontWeight: "bold", marginBottom: "6px" }}>ITEMS</div>
      {order.items.map((item, i) => {
        const savedPerUnit = item.markedPricePerQuantity != null && item.markedPricePerQuantity > item.pricePerQuantity
          ? item.markedPricePerQuantity - item.pricePerQuantity
          : 0;
        return (
          <div key={i} style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{item.name}{item.variantSize ? ` (${item.variantSize})` : ""} ×{item.quantity}</span>
              <span style={{ flexShrink: 0, marginLeft: "8px" }}>₹{item.price.toFixed(2)}</span>
            </div>
            {savedPerUnit > 0 && (
              <div style={{ textAlign: "right", fontSize: "10px", color: "#888", textDecoration: "line-through" }}>
                MRP ₹{(item.markedPricePerQuantity! * item.quantity).toFixed(2)}
              </div>
            )}
          </div>
        );
      })}

      <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "8px 0" }} />

      {/* Bill breakdown */}
      <Row label="Subtotal" value={`₹${order.bills.total.toFixed(2)}`} />
      {!!order.bills.discount && <Row label="Discount" value={`-₹${order.bills.discount.toFixed(2)}`} />}
      {/* Round off is intentionally not shown — total is already rounded, no need to explain the gap */}

      <hr style={{ border: "none", borderTop: "1px solid #000", margin: "8px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "15px", marginBottom: "2px" }}>
        <span>TOTAL</span>
        <span>₹{order.bills.totalWithTax.toFixed(0)}</span>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid #000", margin: "8px 0" }} />

      {/* Payment */}
      <Row label={`Paid (${order.paymentMethod})`} value={`₹${(order.amountPaid || 0).toFixed(2)}`} />
      {balanceDue > 0 && <Row label="Balance Due" value={`₹${balanceDue.toFixed(2)}`} bold />}

      {/* Savings banner */}
      {(() => {
        const totalSaved = order.items.reduce((acc, item) => {
          if (item.markedPricePerQuantity != null && item.markedPricePerQuantity > item.pricePerQuantity) {
            return acc + (item.markedPricePerQuantity - item.pricePerQuantity) * item.quantity;
          }
          return acc;
        }, 0);
        return totalSaved > 0 ? (
          <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#2a8a2a", fontWeight: "bold" }}>
            You saved ₹{totalSaved.toFixed(0)} today!
          </div>
        ) : null;
      })()}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "12px", fontSize: "11px", color: "#777" }}>
        Come again! ❤️
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontWeight: bold ? "bold" : "normal" }}>
    <span>{label}</span>
    <span style={{ flexShrink: 0, marginLeft: "8px" }}>{value}</span>
  </div>
);

export default BillTemplate;
