import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaEdit } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "../../https";
import { enqueueSnackbar } from "notistack";
import type { Order, PaymentMethod } from "../../types";

interface EditPaymentModalProps {
  order: Order;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Online"];

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ order, onClose }) => {
  const queryClient = useQueryClient();
  const [amountPaid, setAmountPaid] = useState(String((order.amountPaid || 0).toFixed(2)));
  const [payMethod, setPayMethod] = useState<PaymentMethod>(order.paymentMethod ?? "Cash");

  const total = order.bills.totalWithTax;
  const paid = parseFloat(amountPaid) || 0;
  const newBalance = Math.max(0, total - paid);
  const isFullyPaid = paid >= total - 0.01;

  const mutation = useMutation({
    mutationFn: () =>
      updateOrder({
        id: order._id,
        amountPaid: paid,
        paymentMethod: payMethod,
        paymentStatus: isFullyPaid ? "Paid" : "Pending",
      } as unknown as { id: string; [key: string]: unknown }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      enqueueSnackbar("Payment updated.", { variant: "success" });
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message || "Failed to update payment.", { variant: "error" });
    },
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18 }}
          className="glass-card w-full max-w-sm rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                <FaEdit className="text-dhaba-accent" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-dhaba-text">Edit Payment</h2>
                <p className="text-xs text-dhaba-muted">Order #{order._id.slice(-6)} · {order.customerDetails.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group">
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
            </button>
          </div>

          {/* Bill summary */}
          <div className="grid grid-cols-3 divide-x divide-dhaba-border/20 border-b border-dhaba-border/20">
            {[
              { label: "Total Bill",  value: `₹${total.toFixed(2)}`,                        color: "text-dhaba-text" },
              { label: "Was Paid",    value: `₹${(order.amountPaid || 0).toFixed(2)}`,       color: "text-dhaba-muted" },
              { label: "New Balance", value: `₹${newBalance.toFixed(2)}`,                    color: newBalance > 0 ? "text-dhaba-danger" : "text-dhaba-success" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-3 text-center">
                <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">{label}</p>
                <p className={`font-display text-base font-bold mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-dhaba-muted uppercase tracking-wider">Amount Paid (₹)</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setAmountPaid("0")}
                    className="text-[10px] font-bold text-dhaba-warning hover:underline"
                  >
                    Unpaid
                  </button>
                  <button
                    onClick={() => setAmountPaid(total.toFixed(2))}
                    className="text-[10px] font-bold text-dhaba-accent hover:underline"
                  >
                    Full Amount
                  </button>
                </div>
              </div>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                min="0"
                step="0.01"
                className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50"
              />
              <p className={`text-[10px] font-semibold mt-1.5 ${isFullyPaid ? "text-dhaba-success" : "text-dhaba-warning"}`}>
                {isFullyPaid ? "✓ Fully paid" : `₹${newBalance.toFixed(2)} will remain outstanding`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">Payment Method</label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    onClick={() => setPayMethod(method)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
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
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || paid < 0 || amountPaid.trim() === ""}
              className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mutation.isPending && (
                <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
              )}
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditPaymentModal;
