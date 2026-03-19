import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaMoneyBillWave } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";
import type { UseMutationResult } from "@tanstack/react-query";
import type { CustomerLedger } from "../../types";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerLedger | null;
  recordPaymentMutation: UseMutationResult<
    unknown,
    unknown,
    { phone: string; amountPaid: number; orderId?: string; notes?: string },
    unknown
  >;
}

const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Other"];

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  recordPaymentMutation,
}) => {
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("Cash");

  useEffect(() => {
    if (isOpen && customer) {
      setAmountPaidInput(customer.balanceDue.toFixed(2));
      setNotes("");
      setSelectedMethod("Cash");
    }
  }, [isOpen, customer]);

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const amount = parseFloat(amountPaidInput);

    if (isNaN(amount) || amount <= 0) {
      enqueueSnackbar("Please enter a valid amount.", { variant: "warning" });
      return;
    }
    if (amount > customer.balanceDue + 0.01) {
      enqueueSnackbar("Amount cannot exceed outstanding balance.", { variant: "warning" });
      return;
    }

    recordPaymentMutation.mutate({
      phone: customer.customerPhone,
      amountPaid: amount,
      notes: notes ? `${notes} (${selectedMethod})` : selectedMethod,
    });
  };

  const isLoading = recordPaymentMutation.isPending;
  const remaining = customer
    ? Math.max(0, customer.balanceDue - (parseFloat(amountPaidInput) || 0))
    : 0;
  const isFullPay =
    customer && parseFloat(amountPaidInput) >= customer.balanceDue - 0.01;

  const inputClass =
    "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {isOpen && customer && (
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
                  <p className="text-xs text-dhaba-muted truncate max-w-[180px]">{customer.customerName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
              >
                <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
              </button>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 divide-x divide-dhaba-border/20 border-b border-dhaba-border/20">
              <div className="px-5 py-3 text-center">
                <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Outstanding</p>
                <p className="font-display text-xl font-bold text-dhaba-danger mt-0.5">
                  ₹{customer.balanceDue.toFixed(2)}
                </p>
              </div>
              <div className="px-5 py-3 text-center">
                <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Remaining After</p>
                <p className={`font-display text-xl font-bold mt-0.5 ${remaining === 0 ? "text-dhaba-success" : "text-dhaba-warning"}`}>
                  ₹{remaining.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Form */}
            <form id="payment-form" onSubmit={handlePaySubmit} className="px-6 py-5 space-y-4">
              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass} style={{ marginBottom: 0 }}>Amount *</label>
                  <button
                    type="button"
                    onClick={() => setAmountPaidInput(customer.balanceDue.toFixed(2))}
                    className="text-[10px] font-bold text-dhaba-accent hover:underline"
                  >
                    Pay Full
                  </button>
                </div>
                <input
                  type="number"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className={inputClass}
                  step="0.01"
                  min="0.01"
                  max={customer.balanceDue}
                  required
                  placeholder={customer.balanceDue.toFixed(2)}
                />
                {isFullPay && (
                  <p className="text-[10px] text-dhaba-success font-semibold mt-1">
                    ✓ Full balance will be cleared
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
                      onClick={() => setSelectedMethod(method)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        selectedMethod === method
                          ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30"
                          : "glass-input text-dhaba-muted hover:text-dhaba-text"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>
                  Notes <span className="normal-case text-dhaba-muted font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Any remarks..."
                />
              </div>
            </form>

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
                type="submit"
                form="payment-form"
                disabled={isLoading}
                className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading && (
                  <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                )}
                {isLoading ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PaymentModal;
