import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaMoneyBillWave, FaSpinner } from "react-icons/fa";
import { enqueueSnackbar } from "notistack";
import { PreOrder } from "../../types";

interface PreOrderPaymentModalProps {
  onClose: () => void;
  item: PreOrder;
  onConfirm: (amountPaid: number, method: string) => Promise<void>;
}

const PreOrderPaymentModal: React.FC<PreOrderPaymentModalProps> = ({ onClose, item, onConfirm }) => {
  const [payMethod, setPayMethod] = useState<"Cash" | "Online">("Cash");
  const estimated = item.estimatedAmount || item.estimatedTotal || 0;
  const deposit = item.depositAmount || 0;
  const balanceDue = Math.max(0, estimated - deposit);

  const [amount, setAmount] = useState<string>(balanceDue > 0 ? balanceDue.toString() : "0");
  const [processing, setProcessing] = useState(false);

  const payingRaw = parseFloat(amount);
  const paying = isNaN(payingRaw) ? 0 : payingRaw;
  const hasInput = amount.trim() !== "";
  const remaining = Math.max(0, balanceDue - paying);
  const isFullPay = hasInput && paying >= balanceDue - 0.01;

  const handlePay = async () => {
    if (!hasInput || paying < 0) {
      enqueueSnackbar("Enter a valid amount.", { variant: "warning" });
      return;
    }
    setProcessing(true);
    try {
      await onConfirm(paying, payMethod);
      onClose();
    } catch (e) {
      // Error handled by parent usually
    } finally {
      if (processing) setProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="bg-[#1A1C23] border border-white/10 w-full max-w-sm rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#1e293b]/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shadow-inner">
                <FaMoneyBillWave className="text-blue-400 text-lg" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg tracking-wide">Complete Order</h2>
                <p className="text-xs text-dhaba-muted font-medium">{item.customerName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
            >
              <FaTimes className="text-white/50 hover:text-white" />
            </button>
          </div>

          {/* Bill summary strip */}
          <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/5 bg-black/20">
            <div className="px-3 py-4 text-center space-y-1">
              <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Estimate</p>
              <p className="font-display text-base font-bold text-white">₹{estimated}</p>
            </div>
            <div className="px-3 py-4 text-center space-y-1">
              <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Deposit</p>
              <p className="font-display text-base font-bold text-dhaba-success">₹{deposit}</p>
            </div>
            <div className="px-3 py-4 text-center space-y-1">
              <p className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Balance</p>
              <p className="font-display text-base font-bold text-dhaba-warning">₹{balanceDue}</p>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 py-6 space-y-5">
            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest">Received</label>
                <button
                  type="button"
                  onClick={() => setAmount(balanceDue.toString())}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 tracking-wider transition-colors"
                >
                  SET FULL
                </button>
              </div>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                <span className="text-white/50 px-4 py-3 bg-white/5 border-r border-white/5 text-sm font-bold">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-transparent text-white font-bold text-lg px-4 py-2 outline-none placeholder:text-white/20"
                  step="1"
                  min="0"
                  placeholder={balanceDue.toString()}
                />
              </div>
              {hasInput && (
                <p className={`text-[10px] font-bold tracking-wide mt-2 flex items-center gap-1.5 ${
                  isFullPay ? "text-dhaba-success" : "text-dhaba-warning"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isFullPay ? "bg-dhaba-success" : "bg-dhaba-warning"}`} />
                  {isFullPay ? "Full balance will be cleared" : `₹${remaining} will remain outstanding`}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Method</label>
              <div className="flex gap-3">
                {(["Cash", "Online"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayMethod(method)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${
                      payMethod === method
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[inset_0_0_15px_rgba(59,130,246,0.2)]"
                        : "bg-white/5 text-white/50 border-transparent hover:bg-white/10 hover:text-white/80"
                    }`}
                  >
                    {method === "Cash" ? "💵 " : "💳 "}{method}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-5 bg-black/40 border-t border-white/5 flex gap-3 justify-end items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-white/50 font-bold text-sm hover:text-white hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={processing || !hasInput || paying < 0}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white min-w-[140px] px-6 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(59,130,246,0.4)] hover:shadow-[0_4px_25px_rgba(59,130,246,0.6)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {processing && <FaSpinner className="animate-spin" />}
              {processing ? "Processing..." : "Mark Completed"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PreOrderPaymentModal;
