import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaUser, FaMoneyBillWave } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrder } from "../../https";
import { enqueueSnackbar } from "notistack";
import type { Order, PaymentMethod } from "../../types";

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Online"];

const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, onClose }) => {
  const queryClient = useQueryClient();

  // Customer info
  const [name, setName]     = useState(order.customerDetails.name);
  const [phone, setPhone]   = useState(order.customerDetails.phone);
  const [guests, setGuests] = useState(String(order.customerDetails.guests));

  // Payment
  const [amountPaid, setAmountPaid] = useState(String((order.amountPaid || 0).toFixed(2)));
  const [payMethod, setPayMethod]   = useState<PaymentMethod>(order.paymentMethod ?? "Cash");

  const total      = order.bills.totalWithTax;
  const paid       = parseFloat(amountPaid) || 0;
  const balance    = Math.max(0, total - paid);
  const isFullPaid = paid >= total - 0.01;

  const mutation = useMutation({
    mutationFn: () =>
      updateOrder({
        id: order._id,
        customerDetails: {
          name:   name.trim(),
          phone:  phone.trim(),
          guests: parseInt(guests) || 1,
        },
        amountPaid:    paid,
        paymentMethod: payMethod,
        paymentStatus: isFullPaid ? "Paid" : "Pending",
      } as unknown as { id: string; [key: string]: unknown }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });
      enqueueSnackbar("Order updated.", { variant: "success" });
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(err.response?.data?.message || "Failed to update order.", { variant: "error" });
    },
  });

  const inputCls = "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const labelCls = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18 }}
          className="glass-card w-full max-w-sm rounded-3xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
            <div>
              <h2 className="font-display text-lg font-bold text-dhaba-text">Edit Order</h2>
              <p className="text-xs text-dhaba-muted mt-0.5">#{order._id.slice(-6)}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group">
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">

            {/* ── Customer Info ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FaUser className="text-dhaba-accent text-xs" />
                <p className="text-xs font-bold text-dhaba-accent uppercase tracking-wider">Customer Info</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Customer name"
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      type="tel"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Guests</label>
                    <input
                      value={guests}
                      onChange={(e) => setGuests(e.target.value.replace(/\D/g, ""))}
                      placeholder="1"
                      type="number"
                      min="1"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Payment ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FaMoneyBillWave className="text-dhaba-success text-xs" />
                <p className="text-xs font-bold text-dhaba-success uppercase tracking-wider">Payment</p>
              </div>

              {/* Bill summary strip */}
              <div className="grid grid-cols-3 divide-x divide-dhaba-border/20 border border-dhaba-border/20 rounded-xl mb-4 overflow-hidden">
                {[
                  { label: "Total",   value: `₹${total.toFixed(2)}`,   color: "text-dhaba-text" },
                  { label: "Was Paid", value: `₹${(order.amountPaid || 0).toFixed(2)}`, color: "text-dhaba-muted" },
                  { label: "Balance", value: `₹${balance.toFixed(2)}`, color: balance > 0 ? "text-dhaba-danger" : "text-dhaba-success" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-2 py-2 text-center">
                    <p className="text-[9px] font-bold text-dhaba-muted uppercase tracking-wider">{label}</p>
                    <p className={`font-display text-sm font-bold mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls} style={{ marginBottom: 0 }}>Amount Paid (₹)</label>
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
                        Full
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    min="0"
                    step="0.01"
                    className={inputCls}
                  />
                  <p className={`text-[10px] font-semibold mt-1 ${isFullPaid ? "text-dhaba-success" : "text-dhaba-warning"}`}>
                    {isFullPaid ? "✓ Fully paid" : `₹${balance.toFixed(2)} will remain outstanding`}
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Payment Method</label>
                  <div className="flex gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setPayMethod(m)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          payMethod === m
                            ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30"
                            : "glass-input text-dhaba-muted hover:text-dhaba-text"
                        }`}
                      >
                        {m === "Cash" ? "💵 " : "💳 "}{m}
                      </button>
                    ))}
                  </div>
                </div>
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
              disabled={mutation.isPending || !name.trim()}
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

export default EditOrderModal;
