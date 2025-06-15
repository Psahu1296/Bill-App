// components/PayModal.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { recordCustomerPayment, updateOrder } from "../../https"; // Adjust path for your API functions
import { useNavigate } from "react-router-dom";

const PAYMENT_METHODS = ["Cash"]; // Common payment types for recording

const PayModal = ({ isOpen, onClose, order, customerData }) => {
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const [amountPaying, setAmountPaying] = useState(''); // Amount customer is paying now
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");

  const totalBill = order?.bills?.totalWithTax|| 0;
  const amountAlreadyPaid = order?.amountPaid || 0;
  const outstandingBalance = totalBill - amountAlreadyPaid;

  // Use a derived state for actual amount to update to if not fully paid
  const remainingToPay = totalBill - amountAlreadyPaid;

  useEffect(() => {
    // Reset form fields when modal opens or order changes
    if (isOpen) {
      setAmountPaying(''); // Clear input
      setSelectedPaymentMethod('Cash');
    }
  }, [isOpen, order]);


  const updateOrderMutation = useMutation({
    mutationFn: ({ id, updates }) => updateOrder({id, ...updates}),
    onSuccess: (res) => {
      enqueueSnackbar(res.message || "Order updated, payment recorded!", { variant: "success" });
      queryClient.invalidateQueries(['orders', order._id]); // Invalidate specific order
      queryClient.invalidateQueries(['orders']); // Invalidate all orders list
      queryClient.invalidateQueries(['customerLedger', customerData.customerPhone]); // Invalidate customer ledger
      queryClient.invalidateQueries(['dashboardEarningsSummary']); // Invalidate earnings if status affects it
      navigate("/" , { replace: true });
      onClose(); // Close the modal
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || "Failed to update order or record payment.";
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Payment Update Error:", error);
    },
  });

  const handleSubmitPayment = () => {
    const paidAmount = parseFloat(amountPaying);

    if (isNaN(paidAmount) || paidAmount <= 0) {
      enqueueSnackbar("Please enter a valid amount to pay.", { variant: "warning" });
      return;
    }

    if (paidAmount > remainingToPay + 0.01) { // Adding a small epsilon for float comparisons
        enqueueSnackbar("Amount paying cannot exceed outstanding balance.", { variant: "warning" });
        return;
    }

    // Determine new payment status based on whether the full amount is now paid
    let newPaymentStatus = "Paid";
    // if (paidAmount >= remainingToPay) {
    //   newPaymentStatus = "Paid";
    // } else {
    //   newPaymentStatus = "Pending"; // It remains pending if partially paid
    // }

    // Construct the updates for the order
    const updatesForOrder = {
      amountPaid: amountAlreadyPaid + paidAmount, // Accumulate paid amount
      paymentMethod: selectedPaymentMethod, // Update payment method if desired
      paymentStatus: newPaymentStatus,
      orderStatus:  "Completed",
      // You might add paymentData specific to Card/UPI here if applicable
      // e.g., if selectedPaymentMethod === 'Card', integrate Razorpay logic here
    };

    updateOrderMutation.mutate({ id: order._id, updates:updatesForOrder});
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
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Record Payment for Order #{order?._id.slice(-6)}</h2>
              <button onClick={onClose} className="text-[#f5f5f5] hover:text-red-500"><IoMdClose size={24} /></button>
            </div>

            {/* Order Summary */}
            <div className="mb-4 text-sm bg-[#1f1f1f] p-3 rounded-lg gap-2">
              <p className="flex justify-between">Total Bill: <span className="font-bold text-yellow-400">₹{totalBill.toFixed(2)}</span></p>
              <p className="flex justify-between">Amount Paid: <span className="font-bold text-green-400">₹{amountAlreadyPaid.toFixed(2)}</span></p>
              <p className="flex justify-between border-t border-gray-600 pt-2 mt-2">Outstanding: <span className="font-bold text-red-400">₹{outstandingBalance.toFixed(2)}</span></p>
            </div>

            {/* Payment Amount Input */}
            <div className="mb-4">
              <label htmlFor="amountPaying" className="block text-sm font-medium text-[#ababab] mb-2">Amount to Pay</label>
              <input
                type="number"
                id="amountPaying"
                value={amountPaying}
                onChange={(e) => setAmountPaying(e.target.value)}
                className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                step="0.01"
                placeholder={remainingToPay.toFixed(2)} // Suggest the remaining amount
              />
            </div>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#ababab] mb-2">Payment Method</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method}
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold
                      ${selectedPaymentMethod === method ? 'bg-yellow-400 text-gray-900' : 'bg-[#1f1f1f] text-[#ababab] hover:bg-[#333]'}
                      transition-colors
                    `}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitPayment}
              disabled={updateOrderMutation.isPending || parseFloat(amountPaying) <= 0 || parseFloat(amountPaying) > remainingToPay + 0.01}
              className="w-full rounded-lg py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateOrderMutation.isPending ? 'Processing...' : 'Record Payment'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PayModal;