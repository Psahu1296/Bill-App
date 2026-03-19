import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaMoneyBillWave } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "../../https";
import { enqueueSnackbar } from "notistack";
import type { Order, PaymentMethod, OrderStatus } from "../../types";

interface PayRemainingModalProps {
  onClose: () => void;
  order: Order;
  balanceDue: number;
  onSuccess: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Online"];

const PayRemainingModal: React.FC<PayRemainingModalProps> = ({
  onClose,
  order,
  balanceDue,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [payMethod, setPayMethod] = useState<PaymentMethod>("Cash");
  const [amount, setAmount] = useState<string>(balanceDue.toFixed(2));

  const paying    = parseFloat(amount) || 0;
  const remaining = Math.max(0, balanceDue - paying);
  const isFullPay = paying >= balanceDue - 0.01;

  const paymentMutation = useMutation({
    mutationFn: (updates: Partial<Order> & { id: string }) =>
      updateOrder(updates as unknown as { id: string; [key: string]: unknown }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarningsSummary"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });
      enqueueSnackbar("Payment recorded successfully!", { variant: "success" });
      onSuccess();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to process payment.", { variant: "error" });
    },
  });

  const handlePay = () => {
    if (paying <= 0) {
      enqueueSnackbar("Enter a valid amount.", { variant: "warning" });
      return;
    }
    if (paying > balanceDue + 0.01) {
      enqueueSnackbar("Payment cannot exceed the balance due.", { variant: "warning" });
      return;
    }

    const newAmountPaid = (order.amountPaid || 0) + paying;
    const fullyPaid = newAmountPaid >= order.bills.totalWithTax - 0.01;

    paymentMutation.mutate({
      id: order._id,
      amountPaid: newAmountPaid,
      paymentMethod: payMethod,
      paymentStatus: (fullyPaid ? "Paid" : "Pending") as typeof order.paymentStatus,
      orderStatus: "Completed" as OrderStatus,
    });
  };

  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="glass-card w-full max-w-sm rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-dhaba-success/10 flex items-center justify-center">
                <FaMoneyBillWave className="text-dhaba-success" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-dhaba-text">Pay Remaining Balance</h2>
                <p className="text-xs text-dhaba-muted">Order #{order._id.slice(-6)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
            >
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
            </button>
          </div>

          {/* Bill summary strip */}
          <div className="grid grid-cols-3 divide-x divide-dhaba-border/20 border-b border-dhaba-border/20">
            {[
              { label: "Total Bill",  value: `₹${order.bills.totalWithTax.toFixed(2)}`, color: "text-dhaba-text" },
              { label: "Paid",        value: `₹${(order.amountPaid || 0).toFixed(2)}`,  color: "text-dhaba-success" },
              { label: "Outstanding", value: `₹${balanceDue.toFixed(2)}`,               color: "text-dhaba-danger" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-3 text-center">
                <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">{label}</p>
                <p className={`font-display text-base font-bold mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="px-6 py-5 space-y-4">
            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass} style={{ marginBottom: 0 }}>Amount to Pay *</label>
                <button
                  type="button"
                  onClick={() => setAmount(balanceDue.toFixed(2))}
                  className="text-[10px] font-bold text-dhaba-accent hover:underline"
                >
                  Pay Full
                </button>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50"
                step="0.01"
                min="0.01"
                max={balanceDue}
                placeholder={balanceDue.toFixed(2)}
              />
              {paying > 0 && (
                <p className={`text-[10px] font-semibold mt-1 ${isFullPay ? "text-dhaba-success" : "text-dhaba-warning"}`}>
                  {isFullPay
                    ? "✓ Full balance will be cleared"
                    : `₹${remaining.toFixed(2)} will remain outstanding`}
                </p>
              )}
            </div>

            {/* Payment method */}
            <div>
              <label className={labelClass}>Payment Method</label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={method === "Online"}
                    onClick={() => setPayMethod(method)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
                      payMethod === method
                        ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30"
                        : "glass-input text-dhaba-muted hover:text-dhaba-text"
                    }`}
                  >
                    {method === "Cash" ? "💵 " : "💳 "}{method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={paymentMutation.isPending || paying <= 0 || paying > balanceDue + 0.01}
              className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {paymentMutation.isPending && (
                <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
              )}
              {paymentMutation.isPending ? "Processing..." : "Confirm Payment"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PayRemainingModal;
