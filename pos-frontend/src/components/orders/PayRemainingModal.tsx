import React, { useState } from "react";
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

const PayRemainingModal: React.FC<PayRemainingModalProps> = ({
  onClose,
  order,
  balanceDue,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [payMethod, setPayMethod] = useState<PaymentMethod>("Cash");
  const [amount, setAmount] = useState<string>(balanceDue.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setIsSubmitting(false);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || "Failed to process payment.";
      enqueueSnackbar(msg, { variant: "error" });
      setIsSubmitting(false);
    },
  });

  const handlePay = () => {
    const paidAmount = parseFloat(amount || "0");
    if (paidAmount <= 0) {
      enqueueSnackbar("Enter a valid amount.", { variant: "warning" });
      return;
    }
    if (paidAmount > balanceDue) {
      enqueueSnackbar("Payment cannot exceed the balance due.", { variant: "warning" });
      return;
    }

    setIsSubmitting(true);
    const newAmountPaid = (order.amountPaid || 0) + paidAmount;
    const isFullyPaid = newAmountPaid >= order.bills.totalWithTax;

    const updates = {
      id: order._id,
      amountPaid: newAmountPaid,
      paymentMethod: payMethod,
      paymentStatus: (isFullyPaid ? "Paid" : "Pending") as typeof order.paymentStatus,
      orderStatus: "Completed" as OrderStatus,
    };

    paymentMutation.mutate(updates);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl w-[400px] shadow-2xl overflow-hidden border border-dhaba-border/30">
        <div className="flex justify-between items-center p-5 border-b border-dhaba-border/20">
          <h2 className="font-display text-xl font-bold text-dhaba-text">Pay Remaining Balance</h2>
          <button
            onClick={onClose}
            className="text-dhaba-muted hover:text-dhaba-text transition-colors text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">Payment Method</label>
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setPayMethod("Cash")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                payMethod === "Cash" ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30" : "glass-input text-dhaba-muted"
              }`}
            >
              💵 Cash
            </button>
            <button
              disabled
              onClick={() => setPayMethod("Online")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all opacity-50 ${
                payMethod === "Online" ? "bg-dhaba-accent/15 text-dhaba-accent border border-dhaba-accent/30" : "glass-input text-dhaba-muted"
              }`}
            >
              💳 Online
            </button>
          </div>

          <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">Amount to Pay</label>
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dhaba-muted font-bold">
              ₹
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full glass-input text-dhaba-text rounded-xl pl-8 pr-4 py-3 focus:outline-none placeholder:text-dhaba-muted/50 font-bold"
            />
          </div>

          <div className="flex justify-between items-center mb-6 px-1">
            <span className="text-dhaba-muted text-sm">Target Balance Due</span>
            <span className="font-display text-lg font-bold text-dhaba-danger">₹{balanceDue.toFixed(2)}</span>
          </div>

          <button
            onClick={handlePay}
            disabled={isSubmitting}
            className={`w-full py-3.5 rounded-xl font-bold tracking-wide text-sm transition-all shadow-glow-lg ${
              isSubmitting ? "opacity-50 cursor-not-allowed btn-accent" : "btn-accent hover:-translate-y-1"
            }`}
          >
            {isSubmitting ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayRemainingModal;
