import type { OrderStatus, PaymentMethod } from "../../types";

interface PastOrderSummaryProps {
  subtotal: number;
  discount: number;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  displayAmountPaid: number;
  onDiscountChange: (v: number) => void;
  onPaymentMethodChange: (v: PaymentMethod) => void;
  onAmountPaidChange: (v: number) => void;
  onOrderStatusChange: (v: OrderStatus) => void;
}

const PastOrderSummary: React.FC<PastOrderSummaryProps> = ({
  subtotal,
  discount,
  finalTotal,
  paymentMethod,
  orderStatus,
  displayAmountPaid,
  onDiscountChange,
  onPaymentMethodChange,
  onAmountPaidChange,
  onOrderStatusChange,
}) => {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted">Bill & Payment</h3>

      {/* Bill rows */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-dhaba-muted">Subtotal</span>
          <span className="font-semibold text-dhaba-text">₹{subtotal}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-dhaba-muted">Discount</span>
          <div className="flex items-center gap-2">
            <span className="text-dhaba-muted">₹</span>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => onDiscountChange(Math.max(0, Number(e.target.value)))}
              className="glass-input rounded-lg px-2 py-1 w-20 text-right text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-between border-t border-dhaba-border/20 pt-2 font-bold">
          <span className="text-dhaba-text">Total</span>
          <span className="text-dhaba-accent text-base">₹{finalTotal}</span>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <p className="text-xs text-dhaba-muted mb-2">Payment Method</p>
        <div className="flex gap-2">
          {(["Cash", "Online"] as PaymentMethod[]).map((pm) => (
            <button
              key={pm}
              onClick={() => onPaymentMethodChange(pm)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                paymentMethod === pm
                  ? "bg-dhaba-accent/20 border-dhaba-accent/40 text-dhaba-accent"
                  : "bg-dhaba-surface/60 border-dhaba-border/30 text-dhaba-muted hover:text-dhaba-text hover:border-dhaba-border/60"
              }`}
            >
              {pm}
            </button>
          ))}
        </div>
      </div>

      {/* Amount paid + order status */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs text-dhaba-muted mb-1">Amount Paid (₹)</p>
          <input
            type="number"
            min={0}
            value={displayAmountPaid}
            onChange={(e) => onAmountPaidChange(Math.max(0, Number(e.target.value)))}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-dhaba-muted mb-1">Order Status</p>
          <select
            value={orderStatus}
            onChange={(e) => onOrderStatusChange(e.target.value as OrderStatus)}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40 bg-transparent"
          >
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Ready">Ready</option>
          </select>
        </div>
      </div>
    </section>
  );
};

export default PastOrderSummary;
