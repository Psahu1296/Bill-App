import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { updateOrder } from "../../https";
import { useNavigate } from "react-router-dom";
import type { Order, AddOrderPayload, PaymentMethod, OrderStatus } from "../../types";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Online"];

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Partial<Order> & { _id?: string };
  customerData: { customerPhone?: string };
  onSubmitPayment: (amountPaid: number, paymentMethod: PaymentMethod, isFullyPaid: boolean) => void;
}

const PayModal: React.FC<PayModalProps> = ({ isOpen, onClose, order, customerData, onSubmitPayment }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [amountPaying, setAmountPaying] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("Cash");

  const totalBill = order?.bills?.totalWithTax ?? 0;
  const amountAlreadyPaid = order?.amountPaid ?? 0;
  const outstandingBalance = totalBill - amountAlreadyPaid;
  const remainingToPay = outstandingBalance;

  useEffect(() => {
    if (isOpen) {
      setAmountPaying("");
      setSelectedPaymentMethod("Cash");
    }
  }, [isOpen, order]);

  const handleSubmitPayment = () => {
    const paidAmount = parseFloat(amountPaying);

    if (isNaN(paidAmount) || paidAmount <= 0) {
      enqueueSnackbar("Please enter a valid amount to pay.", {
        variant: "warning",
      });
      return;
    }
    if (paidAmount > remainingToPay + 0.01) {
      enqueueSnackbar("Amount paying cannot exceed outstanding balance.", {
        variant: "warning",
      });
      return;
    }

    const newAmountPaid = amountAlreadyPaid + paidAmount;
    const isFullyPaid = newAmountPaid >= totalBill - 0.01;

    onSubmitPayment(paidAmount, selectedPaymentMethod, isFullyPaid);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-[#262626] p-6 rounded-lg shadow-lg w-full max-w-sm mx-auto max-h-[90vh] overflow-y-auto text-[#f5f5f5]"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {order._id ? `Record Payment for Order #${order._id.slice(-6)}` : "Record Payment for New Order"}
              </h2>
              <button onClick={onClose} className="text-[#f5f5f5] hover:text-red-500">
                <IoMdClose size={24} />
              </button>
            </div>

            <div className="mb-4 text-sm bg-[#1f1f1f] p-3 rounded-lg gap-2">
              <p className="flex justify-between">
                Total Bill:{" "}
                <span className="font-bold text-yellow-400">
                  ₹{totalBill.toFixed(2)}
                </span>
              </p>
              <p className="flex justify-between">
                Amount Paid:{" "}
                <span className="font-bold text-green-400">
                  ₹{amountAlreadyPaid.toFixed(2)}
                </span>
              </p>
              <p className="flex justify-between border-t border-gray-600 pt-2 mt-2">
                Outstanding:{" "}
                <span className="font-bold text-red-400">
                  ₹{outstandingBalance.toFixed(2)}
                </span>
              </p>
            </div>

            <div className="mb-4">
              <label
                htmlFor="amountPaying"
                className="block text-sm font-medium text-[#ababab] mb-2"
              >
                Amount to Pay
              </label>
              <input
                type="number"
                id="amountPaying"
                value={amountPaying}
                onChange={(e) => setAmountPaying(e.target.value)}
                className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                step="0.01"
                placeholder={remainingToPay.toFixed(2)}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#ababab] mb-2">
                Payment Method
              </label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold
                      ${
                        selectedPaymentMethod === method
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

            <button
              onClick={handleSubmitPayment}
              disabled={
                parseFloat(amountPaying) <= 0 ||
                parseFloat(amountPaying) > remainingToPay + 0.01
              }
              className="w-full rounded-lg py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Record Payment
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PayModal;
