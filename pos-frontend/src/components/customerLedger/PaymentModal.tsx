import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
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

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  customer,
  recordPaymentMutation,
}) => {
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("Cash");

  const isLoading = recordPaymentMutation.isPending;

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
      enqueueSnackbar("Amount cannot exceed outstanding balance.", {
        variant: "warning",
      });
      return;
    }

    recordPaymentMutation.mutate({
      phone: customer.customerPhone,
      amountPaid: amount,
      notes: notes,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && customer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-[#262626] p-6 rounded-lg shadow-lg w-full max-w-sm mx-auto text-[#f5f5f5]"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Record Payment for {customer.customerName}
              </h2>
              <button
                onClick={onClose}
                className="text-[#f5f5f5] hover:text-red-500"
              >
                <IoMdClose size={24} />
              </button>
            </div>

            <div className="mb-4 text-sm bg-[#1f1f1f] p-3 rounded-lg">
              <p className="flex justify-between">
                Phone:{" "}
                <span className="font-semibold">{customer.customerPhone}</span>
              </p>
              <p className="flex justify-between border-t border-gray-600 pt-2 mt-2">
                Outstanding:{" "}
                <span className="font-bold text-red-400">
                  ₹{customer.balanceDue.toFixed(2)}
                </span>
              </p>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-[#ababab] mb-2"
                >
                  Amount Being Paid
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  step="0.01"
                  placeholder={customer.balanceDue.toFixed(2)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#ababab] mb-2">
                  Payment Method
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Cash", "Card", "UPI", "Other"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSelectedMethod(method)}
                      className={`px-3 py-1 rounded-lg text-sm font-semibold
                        ${
                          selectedMethod === method
                            ? "bg-yellow-400 text-gray-900"
                            : "bg-[#1f1f1f] text-[#ababab] hover:bg-[#333]"
                        }
                        transition-colors
                      `}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-[#ababab] mb-2"
                >
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Recording..." : "Record Payment"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PaymentModal;
