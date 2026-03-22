import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaMoneyBillWave } from "react-icons/fa";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrders, updateOrder } from "../../https";
import { enqueueSnackbar } from "notistack";
import type { CustomerLedger, Order } from "../../types";

interface SettleOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerLedger | null;
}

const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Other"];

const SettleOrdersModal: React.FC<SettleOrdersModalProps> = ({ isOpen, onClose, customer }) => {
  const queryClient = useQueryClient();
  const [amountInput, setAmountInput] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all completed orders, filter client-side by customer phone + still has balance
  const { data: pendingOrders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["orders", "settle", customer?.customerPhone],
    queryFn: async () => {
      const res = await getOrders({ orderStatus: "Completed" });
      const all: Order[] = (res.data as { data: Order[] }).data ?? [];
      return all
        .filter(
          (o) =>
            o.customerDetails.phone === customer?.customerPhone &&
            o.paymentStatus === "Pending" &&
            o.bills.totalWithTax - (o.amountPaid || 0) > 0.01
        )
        .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    },
    enabled: isOpen && !!customer,
  });

  const totalOutstanding = pendingOrders.reduce(
    (sum, o) => sum + (o.bills.totalWithTax - (o.amountPaid || 0)),
    0
  );

  // Initialise amount when modal opens / orders load
  React.useEffect(() => {
    if (isOpen && totalOutstanding > 0) {
      setAmountInput(totalOutstanding.toFixed(2));
    }
  }, [isOpen, totalOutstanding]);

  React.useEffect(() => {
    if (!isOpen) {
      setAmountInput("");
      setPayMethod("Cash");
    }
  }, [isOpen]);

  const payingRaw    = parseFloat(amountInput);
  const paying       = isNaN(payingRaw) ? 0 : payingRaw;
  const hasInput     = amountInput.trim() !== "";
  const credit       = Math.max(0, paying - totalOutstanding);
  const remaining    = Math.max(0, totalOutstanding - paying);
  const isOverpay    = hasInput && paying > totalOutstanding + 0.01;
  const isFullSettle = hasInput && paying >= totalOutstanding - 0.01;

  const handleSettle = async () => {
    if (!hasInput || isNaN(payingRaw) || paying <= 0) {
      enqueueSnackbar("Enter a valid amount.", { variant: "warning" });
      return;
    }
    if (pendingOrders.length === 0) return;

    setIsSubmitting(true);
    try {
      let leftover = paying;

      for (let i = 0; i < pendingOrders.length; i++) {
        if (leftover <= 0.01) break;
        const order = pendingOrders[i];
        const orderBalance = order.bills.totalWithTax - (order.amountPaid || 0);
        // For the last order allow overpayment so excess credit is stored on it
        const isLast = i === pendingOrders.length - 1;
        const applyAmount = isLast ? leftover : Math.min(leftover, orderBalance);
        const newAmountPaid = (order.amountPaid || 0) + applyAmount;
        const fullyPaid = newAmountPaid >= order.bills.totalWithTax - 0.01;

        await updateOrder({
          id: order._id,
          amountPaid: newAmountPaid,
          paymentMethod: payMethod,
          paymentStatus: fullyPaid ? "Paid" : "Pending",
          orderStatus: "Completed",
        } as { id: string; [key: string]: unknown });

        leftover -= applyAmount;
      }

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });
      enqueueSnackbar(
        isOverpay
          ? `Tab settled · ₹${credit.toFixed(0)} credit stored for ${customer?.customerName}`
          : isFullSettle
            ? `Tab fully settled for ${customer?.customerName}!`
            : `₹${paying.toFixed(0)} applied across orders.`,
        { variant: "success" }
      );
      onClose();
    } catch {
      enqueueSnackbar("Failed to settle orders. Please try again.", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";
  const inputClass =
    "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";

  return (
    <AnimatePresence>
      {isOpen && customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass-card w-full max-w-md rounded-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                  <FaMoneyBillWave className="text-dhaba-accent" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-dhaba-text">Settle Tab</h2>
                  <p className="text-xs text-dhaba-muted truncate max-w-[200px]">{customer.customerName} · {customer.customerPhone}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group">
                <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
              </button>
            </div>

            {/* Outstanding orders list */}
            <div className="px-6 pt-5 pb-3">
              <p className={labelClass}>Outstanding Orders</p>
              {loadingOrders ? (
                <div className="flex items-center gap-2 text-dhaba-muted text-sm py-4">
                  <div className="h-4 w-4 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
                  Loading orders...
                </div>
              ) : pendingOrders.length === 0 ? (
                <p className="text-dhaba-muted text-sm py-4">No outstanding orders found for this customer.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingOrders.map((order) => {
                    const due = order.bills.totalWithTax - (order.amountPaid || 0);
                    return (
                      <div key={order._id} className="flex justify-between items-center glass-input rounded-xl px-4 py-2.5">
                        <div>
                          <p className="text-dhaba-text text-sm font-semibold">Order #{order._id.slice(-6).toUpperCase()}</p>
                          <p className="text-dhaba-muted text-xs mt-0.5">
                            {new Date(order.orderDate).toLocaleDateString("en-IN")} · Bill ₹{order.bills.totalWithTax.toFixed(0)}
                          </p>
                        </div>
                        <p className="text-dhaba-danger font-bold text-sm">₹{due.toFixed(0)} due</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {pendingOrders.length > 0 && (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-2 divide-x divide-dhaba-border/20 border-y border-dhaba-border/20 mx-6 rounded-xl overflow-hidden mb-5">
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Total Outstanding</p>
                    <p className="font-display text-xl font-bold text-dhaba-danger mt-0.5">₹{totalOutstanding.toFixed(2)}</p>
                  </div>
                  <div className="px-4 py-3 text-center">
                    <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">
                      {isOverpay ? "Credit After" : "Remaining After"}
                    </p>
                    <p className={`font-display text-xl font-bold mt-0.5 ${isOverpay ? "text-dhaba-success" : remaining === 0 ? "text-dhaba-success" : "text-yellow-400"}`}>
                      ₹{isOverpay ? credit.toFixed(2) : remaining.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-5 space-y-4">
                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={labelClass} style={{ marginBottom: 0 }}>Amount to Pay *</label>
                      <button
                        type="button"
                        onClick={() => setAmountInput(totalOutstanding.toFixed(2))}
                        className="text-[10px] font-bold text-dhaba-accent hover:underline"
                      >
                        Pay Full
                      </button>
                    </div>
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className={inputClass}
                      step="0.01"
                      min="0.01"
                      placeholder={totalOutstanding.toFixed(2)}
                    />
                    {hasInput && paying > 0 && (
                      <p className={`text-[10px] font-semibold mt-1 ${isOverpay || isFullSettle ? "text-dhaba-success" : "text-yellow-400"}`}>
                        {isOverpay
                          ? `✓ Tab cleared · ₹${credit.toFixed(2)} credit stored on most recent order`
                          : isFullSettle
                            ? `✓ Full tab settled — payment applied across ${pendingOrders.length} order(s)`
                            : `₹${remaining.toFixed(2)} will remain outstanding (applied oldest-first)`}
                      </p>
                    )}
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className={labelClass}>Payment Method</label>
                    <div className="flex gap-2 flex-wrap">
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPayMethod(method)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            payMethod === method
                              ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30"
                              : "glass-input text-dhaba-muted hover:text-dhaba-text"
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
              >
                Cancel
              </button>
              {pendingOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={isSubmitting || !hasInput || paying <= 0}
                  className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting && (
                    <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                  )}
                  {isSubmitting ? "Settling..." : "Confirm Settlement"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettleOrdersModal;
