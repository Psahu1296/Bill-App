import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaMoneyBillWave } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";
import type { Order, PaymentMethod } from "../../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Online"];

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Partial<Order> & { _id?: string };
  customerData: { customerPhone?: string };
  onSubmitPayment: (amountPaid: number, paymentMethod: PaymentMethod, isFullyPaid: boolean) => void;
}

const PayModal: React.FC<PayModalProps> = ({ isOpen, onClose, order, onSubmitPayment }) => {
  const [amountPaying, setAmountPaying] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("Cash");

  const totalBill         = order?.bills?.totalWithTax ?? 0;
  const amountAlreadyPaid = order?.amountPaid ?? 0;
  const outstanding       = totalBill - amountAlreadyPaid;

  const payingRaw = parseFloat(amountPaying);
  const payingNum = isNaN(payingRaw) ? 0 : payingRaw;
  const hasInput  = amountPaying.trim() !== "";

  const credit    = Math.max(0, payingNum - outstanding);
  const remaining = Math.max(0, outstanding - payingNum);
  const isOverpay  = hasInput && payingNum > outstanding + 0.01;
  const isPayLater = hasInput && payingNum === 0;
  const toledger   = remaining > 0.01 && hasInput && payingNum > 0;

  const isFullyPaid = hasInput && payingNum >= outstanding - 0.01;
  const canSubmit   = hasInput && payingNum >= 0;

  useEffect(() => {
    if (isOpen) {
      setAmountPaying(outstanding > 0 ? outstanding.toFixed(2) : "");
      setSelectedPaymentMethod("Cash");
    }
  }, [isOpen, order]);

  const handleSubmit = () => {
    if (!hasInput || isNaN(payingRaw) || payingNum < 0) {
      enqueueSnackbar("Please enter a valid amount.", { variant: "warning" });
      return;
    }
    onSubmitPayment(payingNum, selectedPaymentMethod, isFullyPaid);
  };

  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {isOpen && (
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
                  <h2 className="font-display text-lg font-bold text-dhaba-text">Record Payment</h2>
                  <p className="text-xs text-dhaba-muted">
                    {order._id ? `Order #${order._id.slice(-6)}` : "New Order"}
                  </p>
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
                { label: "Total Bill",   value: `₹${totalBill.toFixed(2)}`,         color: "text-dhaba-text" },
                { label: "Paid",         value: `₹${amountAlreadyPaid.toFixed(2)}`, color: "text-dhaba-success" },
                { label: "Outstanding",  value: `₹${outstanding.toFixed(2)}`,       color: "text-dhaba-danger" },
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
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAmountPaying("0")}
                      className="text-[10px] font-bold text-dhaba-warning hover:underline"
                    >
                      Pay Later
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountPaying(outstanding.toFixed(2))}
                      className="text-[10px] font-bold text-dhaba-accent hover:underline"
                    >
                      Pay Full
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={amountPaying}
                  onChange={(e) => setAmountPaying(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50"
                  step="0.01"
                  min="0"
                  placeholder={outstanding.toFixed(2)}
                />
                {/* Live feedback */}
                {hasInput && (
                  <p className={`text-[10px] font-semibold mt-1 ${
                    isPayLater ? "text-dhaba-warning"
                    : isOverpay ? "text-dhaba-success"
                    : toledger  ? "text-dhaba-warning"
                    : "text-dhaba-success"
                  }`}>
                    {isPayLater
                      ? "Full amount will be added to customer's tab"
                      : isOverpay
                        ? `✓ Bill paid · ₹${credit.toFixed(2)} credit for next visit`
                        : toledger
                          ? `₹${remaining.toFixed(2)} will be added to customer's tab`
                          : "✓ Full balance will be cleared"}
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
                      onClick={() => setSelectedPaymentMethod(method)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        selectedPaymentMethod === method
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
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPayLater ? "Add to Tab" : "Record Payment"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PayModal;
